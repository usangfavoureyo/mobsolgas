import { NextResponse } from "next/server";
import { createAuthClient } from "@/lib/push";
import { createClient } from "@supabase/supabase-js";

const noStore = { "Cache-Control": "no-store, max-age=0" };

async function authenticatedUser(request: Request) {
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  const auth = createAuthClient();
  if (!token || !auth) return null;
  const { data, error } = await auth.auth.getUser(token);
  return error ? null : data.user;
}

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } }) : null;
}

export async function POST(request: Request) {
  const user = await authenticatedUser(request);
  if (!user) return NextResponse.json({ error: "Sign in to enable order notifications." }, { status: 401, headers: noStore });
  const db = serviceClient();
  if (!db) return NextResponse.json({ error: "Push notifications are not configured on this server." }, { status: 503, headers: noStore });
  let subscription: { endpoint?: unknown; expirationTime?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };
  try { subscription = await request.json(); } catch { return NextResponse.json({ error: "Invalid subscription data." }, { status: 400, headers: noStore }); }
  const endpoint = subscription.endpoint;
  const p256dh = subscription.keys?.p256dh;
  const authKey = subscription.keys?.auth;
  const expiration = subscription.expirationTime;
  let endpointUrl: URL | null = null;
  try { if (typeof endpoint === "string") endpointUrl = new URL(endpoint); } catch { /* Validated below. */ }
  const allowedPushHost = endpointUrl && (endpointUrl.hostname === "fcm.googleapis.com" || endpointUrl.hostname === "web.push.apple.com"
    || endpointUrl.hostname.endsWith(".push.services.mozilla.com") || endpointUrl.hostname.endsWith(".notify.windows.com"));
  if (typeof endpoint !== "string" || endpoint.length < 20 || endpoint.length > 2048 || !endpointUrl || endpointUrl.protocol !== "https:" || endpointUrl.username || endpointUrl.password || !allowedPushHost
    || typeof p256dh !== "string" || p256dh.length > 256 || typeof authKey !== "string" || authKey.length > 256
    || (expiration !== null && expiration !== undefined && (typeof expiration !== "number" || !Number.isFinite(expiration)))) {
    return NextResponse.json({ error: "Invalid push subscription." }, { status: 400, headers: noStore });
  }
  const { count, error: countError } = await db.from("push_subscriptions").select("id", { count: "exact", head: true }).eq("user_id", user.id);
  if (countError) return NextResponse.json({ error: "Push notifications aren’t available until the subscription table is configured." }, { status: 503, headers: noStore });
  const { data: existing } = await db.from("push_subscriptions").select("id").eq("endpoint", endpoint).maybeSingle();
  if (!existing && (count || 0) >= 10) return NextResponse.json({ error: "You can enable notifications on up to 10 devices." }, { status: 409, headers: noStore });
  const { error } = await db.from("push_subscriptions").upsert({ user_id: user.id, endpoint, p256dh, auth_key: authKey, expiration_time: expiration ?? null, updated_at: new Date().toISOString() }, { onConflict: "endpoint" });
  if (error) return NextResponse.json({ error: "Couldn’t save your notification settings. Apply the push subscriptions migration and try again." }, { status: 503, headers: noStore });
  return NextResponse.json({ enabled: true }, { headers: noStore });
}

export async function DELETE(request: Request) {
  const user = await authenticatedUser(request);
  if (!user) return NextResponse.json({ error: "Sign in to update notification settings." }, { status: 401, headers: noStore });
  const db = serviceClient();
  if (!db) return NextResponse.json({ error: "Push notifications are not configured on this server." }, { status: 503, headers: noStore });
  let body: { endpoint?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400, headers: noStore }); }
  if (typeof body.endpoint !== "string" || body.endpoint.length > 2048) return NextResponse.json({ error: "Invalid subscription endpoint." }, { status: 400, headers: noStore });
  const { error } = await db.from("push_subscriptions").delete().eq("user_id", user.id).eq("endpoint", body.endpoint);
  if (error) return NextResponse.json({ error: "Couldn’t update your notification settings." }, { status: 503, headers: noStore });
  return NextResponse.json({ enabled: false }, { headers: noStore });
}
