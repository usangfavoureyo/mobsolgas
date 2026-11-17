import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return NextResponse.json({ error: "Pricing is not configured." }, { status: 503 });
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const [{ data: rate, error: rateError }, { data: products, error: productsError }] = await Promise.all([
    db.from("gas_rates").select("price_per_kg_kobo, currency, effective_from")
      .eq("active", true).lte("effective_from", new Date().toISOString())
      .order("effective_from", { ascending: false }).limit(1).maybeSingle(),
    db.from("products").select("id, weight_kg, price_kobo, available").eq("active", true).order("display_order"),
  ]);
  if (rateError || productsError || !rate) return NextResponse.json({ error: "Pricing is unavailable." }, { status: 503 });
  return NextResponse.json({ ratePerKgKobo: rate.price_per_kg_kobo, currency: rate.currency, effectiveFrom: rate.effective_from, products }, { headers: { "Cache-Control": "no-store, max-age=0" } });
}
