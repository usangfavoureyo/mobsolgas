# Implementation checklist

## Foundation
- [x] Confirm Mobsol Gas identity, Abuja launch market, and web + native iOS/Android scope.
- [x] Define shared backend and client architecture.
- [x] Establish design tokens, role outline and workspace scripts.
- [x] Define both themes, customer navigation, and mobile/desktop interaction rules.
- [x] Copy the supplied Hugeicons SVG set into web and native asset folders.
- [x] Add first-pass customer app shells for web and iOS/Android, with responsive navigation and theme preference.
- [x] Add web manifest and safe static offline fallback shell.
- [ ] Finish native SVG transformer installation and verify icons on device builds.
- [ ] Replace temporary order/cart icons when the matching Hugeicons pairs are provided.
- [x] Add an initial core Supabase migration and customer-side RLS policies.
- [x] Add staff/rider, dispatch, payment, inventory, support, notification and audit tables with role-scoped RLS.
- [x] Add a local-only demo seed for products, an explicitly approximate service zone, delivery fees and cylinder fixtures.
- [ ] Apply migrations and seeds on a local Supabase instance (Docker is unavailable in this environment).

## Delivery
- [x] Add the authenticated, idempotent server-side order creation endpoint with database-calculated price/zone snapshots.
- [ ] Connect the customer UI to auth, live catalog/address data, and the order endpoint; add actual inventory reservation.
- [ ] Paystack online payments; cash and physical POS collection workflows.
- [ ] Dispatch, rider mobile workflow, cylinder exchange ledger and delivery evidence.
- [ ] Operations dashboard, inventory, finance reconciliation, support and audit log.
- [ ] Realtime tracking, notifications, accessibility and release setup.
- [ ] Build the Profile wallet page: balance, add funds, withdraw, payment methods, and promo-code entry. Exclude trip profiles and received vouchers.

## Decisions / configuration needed for live operation
- [ ] Supabase staging and production projects and credentials.
- [ ] Paystack account and webhook configuration.
- [ ] Google Maps Platform project and enabled APIs.
- [ ] Abuja service boundaries, delivery fees and product pricing from the business.
- [ ] Business contact, support channels, privacy policy and terms.
