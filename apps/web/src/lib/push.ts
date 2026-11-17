import { createClient } from "@supabase/supabase-js";
import { sendNotification, setVapidDetails } from "web-push";

type PushPayload = { title: string; body: string; url?: string; tag?: string };
type StoredSubscription = { endpoint: string; p256dh: string; auth_key: string; expiration_time: number | null };

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function sendPushToUser(userId: string, payload: PushPayload) {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const db = adminClient();
  if (!publicKey || !privateKey || !db) return;

  setVapidDetails("https://mobsolgas.vercel.app", publicKey, privateKey);
  const { data, error } = await db.from("push_subscriptions")
    .select("endpoint,p256dh,auth_key,expiration_time").eq("user_id", userId);
  if (error) {
    console.error("push subscriptions unavailable", { code: error.code });
    return;
  }

  await Promise.all((data as StoredSubscription[]).map(async (stored) => {
    try {
      await sendNotification({ endpoint: stored.endpoint, expirationTime: stored.expiration_time, keys: { p256dh: stored.p256dh, auth: stored.auth_key } }, JSON.stringify(payload), { TTL: 3600 });
    } catch (error) {
      const statusCode = typeof error === "object" && error && "statusCode" in error ? Number(error.statusCode) : 0;
      if (statusCode === 404 || statusCode === 410) {
        await db.from("push_subscriptions").delete().eq("endpoint", stored.endpoint);
      } else {
        console.error("push delivery failed", { statusCode });
      }
    }
  }));
}

export function createAuthClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } });
}
