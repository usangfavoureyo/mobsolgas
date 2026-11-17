# Mobsol PWA, push notifications, and caching

The web app manifest provides standalone install metadata and shortcuts for shopping, orders, and activity. The service worker caches the app shell, versioned Next.js assets, app icons, and product artwork. It uses a network-first strategy for navigations and falls back to the cached app shell or offline page. `/api/*` responses, including orders and pricing, are always network-only so account and commercial data are not stored by the service worker.

Web Push is opt-in under **Profile → Safety → Delivery updates**. It requires an authenticated Mobsol account, HTTPS, browser notification permission, the Web Push VAPID pair in Vercel, the push subscription migration below, and Supabase server credentials. Push is currently sent when an order is created and when Paystack confirms payment. Future delivery status update handlers should call `sendPushToUser` with a concise event message.

## Database setup

Apply `supabase/migrations/20261116190000_push_subscriptions.sql` to the Mobsol Supabase project. The migration stores endpoints only for authenticated users; row-level security blocks direct client access and the server uses the service role key.

The Supabase connector available in the development workspace currently points to an inactive project named **Screen Render**, which is not the Mobsol database, so the migration was saved locally and was not applied to that unrelated project.

## Vercel configuration

The production Vercel project now has a newly generated VAPID public key and server-only private key configured for production, preview, and development. Keep `VAPID_PRIVATE_KEY` private. The app also needs the existing Supabase variables (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`) configured in the correct Mobsol deployment environment before subscription persistence and delivery can work.

Push delivery uses the standard Web Push protocol and expires stale 404/410 subscriptions automatically. On iOS, web push is available to web apps added to the Home Screen on supported iOS versions; it is separate from native APNs push in the Expo app.
