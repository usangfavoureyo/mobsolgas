import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return NextResponse.json({ error: "Sign in before paying." }, { status: 401 });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publicKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!supabaseUrl || !publicKey || !serviceKey || !secretKey || !siteUrl) {
    return NextResponse.json({ error: "Payments are not configured on this server yet." }, { status: 503 });
  }

  let body: { orderId?: unknown; channel?: unknown; platform?: unknown };
  try { body = await request.json() as typeof body; }
  catch { return NextResponse.json({ error: "Invalid payment request." }, { status: 400 }); }
  if (typeof body.orderId !== "string" || !/^[0-9a-f-]{36}$/i.test(body.orderId)
    || (body.channel !== "card" && body.channel !== "bank_transfer")
    || (body.platform !== undefined && body.platform !== "mobile")) {
    return NextResponse.json({ error: "Choose a valid order and payment method." }, { status: 400 });
  }

  const auth = createClient(supabaseUrl, publicKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: authData, error: authError } = await auth.auth.getUser(token);
  if (authError || !authData.user?.email) return NextResponse.json({ error: "A valid account email is required for payment." }, { status: 401 });

  const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: order, error: orderError } = await db.from("orders")
    .select("id, order_number, customer_id, total_kobo, currency, payment_status")
    .eq("id", body.orderId).eq("customer_id", authData.user.id).maybeSingle();
  if (orderError || !order) return NextResponse.json({ error: "We couldn’t find that order." }, { status: 404 });
  if (order.payment_status === "paid" || Number(order.total_kobo) < 1) {
    return NextResponse.json({ error: "This order cannot be paid again." }, { status: 409 });
  }

  const reference = `mobsol-${order.order_number}-${randomUUID()}`;
  const channel = body.channel;
  const callback = new URL("/api/payments/callback", siteUrl);
  if (body.platform === "mobile") callback.searchParams.set("native", "1");
  const initialized = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST",
    headers: { Authorization: `Bearer ${secretKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      email: authData.user.email,
      amount: Number(order.total_kobo),
      currency: "NGN",
      reference,
      channels: [channel],
      callback_url: callback.toString(),
      metadata: { order_id: order.id, order_number: order.order_number },
    }),
    cache: "no-store",
  });
  const payload = await initialized.json().catch(() => null) as { status?: boolean; message?: string; data?: { authorization_url?: string; reference?: string } } | null;
  if (!initialized.ok || !payload?.status || !payload.data?.authorization_url || payload.data.reference !== reference) {
    console.error("Paystack initialize failed", { status: initialized.status });
    return NextResponse.json({ error: "Paystack couldn’t start this payment. Please try again." }, { status: 502 });
  }

  const { data: pendingPayment } = await db.from("payments").select("id")
    .eq("order_id", order.id).eq("provider", "paystack").eq("status", "pending")
    .is("provider_reference", null).order("created_at", { ascending: false }).limit(1).maybeSingle();
  const paymentWrite = pendingPayment
    ? await db.from("payments").update({ provider_reference: reference, updated_at: new Date().toISOString() }).eq("id", pendingPayment.id).select("id").single()
    : await db.from("payments").insert({
      order_id: order.id, provider: "paystack", provider_reference: reference,
      amount_kobo: order.total_kobo, currency: "NGN", status: "pending", payer_party: "customer",
    }).select("id").single();
  const { data: payment, error: paymentError } = paymentWrite;
  if (paymentError || !payment) {
    console.error("Paystack payment record failed", { code: paymentError?.code });
    return NextResponse.json({ error: "We couldn’t save this payment attempt. Please try again." }, { status: 502 });
  }

  return NextResponse.json({ authorizationUrl: payload.data.authorization_url, reference });
}
