import { createHmac, timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { sendPushToUser } from "@/lib/push";

async function reconcile(reference: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!supabaseUrl || !serviceKey || !secretKey) return false;
  const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: payment } = await db.from("payments").select("id, order_id, amount_kobo, currency, status")
    .eq("provider_reference", reference).eq("provider", "paystack").maybeSingle();
  if (!payment) return false;
  const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${secretKey}` }, cache: "no-store",
  });
  const result = await response.json().catch(() => null) as { status?: boolean; data?: { status?: string; amount?: number; currency?: string; reference?: string } } | null;
  const paid = response.ok && result?.status && result.data?.status === "success"
    && result.data.reference === reference && result.data.currency === payment.currency
    && Number(result.data.amount) === Number(payment.amount_kobo);
  if (!paid) return false;
  const paidAt = new Date().toISOString();
  await db.from("payments").update({ status: "paid", paid_at: paidAt, updated_at: paidAt })
    .eq("id", payment.id).neq("status", "paid");
  await db.from("orders").update({ payment_status: "paid", delivery_status: "confirmed", confirmed_at: paidAt, updated_at: paidAt })
    .eq("id", payment.order_id).neq("payment_status", "paid");
  if (payment.status !== "paid") {
    const { data: order } = await db.from("orders").select("id, order_number, customer_id").eq("id", payment.order_id).maybeSingle();
    if (order?.customer_id) await sendPushToUser(order.customer_id, { title: "Payment received", body: `Payment for Mobsol order #${order.order_number} is confirmed.`, url: "/?tab=Orders", tag: `payment-${order.id}` }).catch((pushError) => console.error("payment push notification failed", pushError));
  }
  return true;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const reference = url.searchParams.get("reference") ?? "";
  if (!/^[A-Za-z0-9.=-]{1,100}$/.test(reference)) return NextResponse.redirect(new URL("/?payment=invalid", url));
  const successful = await reconcile(reference);
  if (url.searchParams.get("native") === "1") {
    return NextResponse.redirect(new URL(`mobsolgas://payment?status=${successful ? "success" : "pending"}`, url));
  }
  return NextResponse.redirect(new URL(successful ? "/?payment=success" : "/?payment=pending", url));
}

export async function POST(request: Request) {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  const signingSecret = process.env.PAYSTACK_WEBHOOK_SECRET;
  if (!secretKey) return NextResponse.json({ error: "Not configured" }, { status: 503 });
  const raw = await request.text();
  const legacyHeader = request.headers.get("x-paystack-signature");
  const currentHeader = request.headers.get("paystack-signature");
  let valid = false;

  if (currentHeader && signingSecret) {
    const values = Object.fromEntries(currentHeader.split(",").map((part) => part.trim().split("=", 2)));
    const timestamp = Number(values.t);
    const signatures = currentHeader.split(",").map((part) => part.trim()).filter((part) => part.startsWith("v1="))
      .map((part) => part.slice(3).split(":").pop() ?? "");
    if (Number.isFinite(timestamp) && Math.abs(Date.now() / 1000 - timestamp) <= 300) {
      const expected = createHmac("sha512", signingSecret).update(`${timestamp}.${raw}`).digest("hex");
      valid = signatures.some((signature) => signature.length === expected.length
        && timingSafeEqual(Buffer.from(signature), Buffer.from(expected)));
    }
  } else if (legacyHeader) {
    const expected = createHmac("sha512", secretKey).update(raw).digest("hex");
    valid = legacyHeader.length === expected.length && timingSafeEqual(Buffer.from(legacyHeader), Buffer.from(expected));
  }
  if (!valid) return NextResponse.json({ error: "Invalid webhook signature." }, { status: 401 });

  let event: { event?: string; data?: { reference?: string } };
  try { event = JSON.parse(raw) as typeof event; }
  catch { return NextResponse.json({ error: "Invalid JSON." }, { status: 400 }); }
  if (event.event === "charge.success" && event.data?.reference) await reconcile(event.data.reference);
  return NextResponse.json({ received: true });
}
