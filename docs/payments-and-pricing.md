# Payments and cylinder pricing

The web and Expo clients use the same Mobsol API and Supabase project. Paystack secrets belong only on the API server. The apps redirect to Paystack Checkout for card entry or bank transfer; Mobsol never receives a card number, expiry date, or CVV.

## Server configuration

Copy `apps/web/.env.example` to the web server's environment and set:

- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` for Supabase Auth.
- `SUPABASE_SERVICE_ROLE_KEY` for server-side order and payment writes. Keep it private.
- `PAYSTACK_SECRET_KEY` from the matching Paystack test or live mode.
- `PAYSTACK_WEBHOOK_SECRET` from Paystack's webhook signing configuration.
- `NEXT_PUBLIC_SITE_URL` to the canonical HTTPS site origin.

Set the Expo variables shown in `apps/mobile/.env.example` to the same API URL and Supabase project. The mobile app opens the same Paystack hosted checkout URL as the web app.

Configure this Paystack webhook URL in the Paystack dashboard:

`https://<your-site>/api/payments/callback`

The callback verifies transactions against Paystack and reconciles only a matching reference, amount, currency, and order. The webhook signature is checked before events are accepted.

## Daily gas rate

The migration creates `public.gas_rates` and sets the initial configured rate to **₦2,000 per kg**. This is the rate supplied for the current app design, not an independently verified market quote. The home page shows “Gas rates today” on the left and the current “1 kg of gas = ₦…” rate on the right, above the cylinder cards. Web and mobile subscribe to Supabase Realtime for immediate rate changes, refresh from the shared API every 15 seconds as a fallback, and refresh when the app or browser becomes active. The pricing endpoint bypasses response caching.

To change the price, an authorized operator updates the current rate in `public.gas_rates` in the Supabase dashboard when the new price takes effect. The database trigger recalculates product prices, and both clients pick up the updated rate automatically. Existing orders keep their saved price snapshots. Do not pre-insert a future-dated rate unless a scheduled activation mechanism is added.

At the initial rate, gas-only prices are:

- 6 kg: ₦12,000
- 12 kg: ₦24,000
- 22 kg: ₦44,000

Delivery is added by the existing server-side delivery-zone pricing. To change the rate later, an administrator can insert a new effective row into `gas_rates`; clients read the active rate and cylinder prices from `/api/pricing`. Order item prices are stored as snapshots when orders are placed.

Apply the new Supabase migration before enabling checkout. The payment UI needs a deployed API with Supabase and Paystack credentials before real orders can be placed.
