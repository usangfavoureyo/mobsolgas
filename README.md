# Mobsol Gas

Mobsol Gas is an Abuja cylinder exchange and delivery service. The product is designed as a shared platform with a customer and operations web experience plus native iOS and Android apps.

## Product architecture

- `apps/web`: Next.js App Router for customer ordering and operations administration.
- `apps/mobile`: Expo / React Native app for iOS and Android, with customer and rider experiences.
- Supabase: shared PostgreSQL, Auth, Storage and Realtime backend. Enforce authorization in server code and Row Level Security.
- Paystack: online payments, initialized and verified on the server.
- Google Maps Platform: address search, service-zone checks and routing.

The mobile app is a first-class native app, not simply a wrapped website or PWA. Both clients use the same business rules and backend. Do not put service-role keys or payment secrets in either client.

## Local development

Web setup is in `apps/web`. Mobile setup is in `apps/mobile`. Environment variable examples will be kept in each app; never commit real credentials. Supabase schema changes belong in versioned migrations.

## Product constraints

- Launch in Abuja, Nigeria; currency is NGN.
- Mobsol Gas supplies and tracks its own 6 kg, 12 kg and 22 kg cylinders. Customers exchange an empty Mobsol cylinder for a full one; this is not home refilling.
- There is no cylinder deposit in the initial business model.
- Prices and active delivery zones are configured by authorized staff, never hardcoded in the client.
- Delivery and payment status are separate. Cylinder custody and order transitions are auditable.
