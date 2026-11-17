import { NextResponse } from "next/server";

export async function GET() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!publicKey) return NextResponse.json({ error: "Push notifications are not configured yet." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  return NextResponse.json({ publicKey }, { headers: { "Cache-Control": "no-store, max-age=0" } });
}
