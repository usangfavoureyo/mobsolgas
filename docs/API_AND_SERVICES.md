# API and service boundaries

The web app and iOS/Android app share the same Supabase identity and database, with authorized operations exposed through server-side functions / route handlers. The browser and native clients must never receive service-role or Paystack secret keys.

## Required operations
- `catalog.list`: active product and current price information.
- `serviceability.check`: validate coordinates against active delivery polygons and return applicable fee.
- `orders.create`: `POST /api/orders` verifies the bearer session, requires an `Idempotency-Key` UUID, and calls a server-only database function. The function checks active products, recipient, saved/manual address, active zone and delivery fee; calculates totals from database prices; and atomically writes order/item/payment/status snapshots. It does not accept client-supplied prices.
- `orders.transition`: validate allowed delivery transition, actor, assignment and evidence; append status history.
- `dispatch.assign`: atomically assign an eligible order and append assignment history.
- `payments.initialize`: server calculates payable amount and initializes Paystack.
- `payments.webhook`: verify signature, then verify reference, amount, currency and order; process once.
- `collections.record`: rider records cash/POS collection details; finance reconciles independently.
- `exchange.complete`: record full cylinder, empty cylinder, IDs, conditions, discrepancy and custody movement.
- `delivery.complete`: require configured OTP/customer confirmation/evidence and lock completed event.

The order endpoint requires `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and server-only `SUPABASE_SERVICE_ROLE_KEY`. See `apps/web/.env.example`. It creates a payment record and leaves Paystack initialization/verification to the separate payment operations above.

`POST /api/orders` accepts an `Authorization: Bearer <Supabase access token>` header and a UUID `Idempotency-Key`. Its JSON body contains `items` (`productId`, `quantity`), either `addressId` or `addressText` plus `latitude`/`longitude`, optional `instructions`, `recipientName`, `recipientPhone`, and `scheduledFor`, plus `payerParty` (`customer` or `recipient`) and `paymentMethod` (`paystack`, `cash`, or `pos`). A repeated request with the same customer and idempotency key returns the original order.

## Delivery states
`pending → confirmed → preparing → awaiting_rider → assigned → accepted → on_the_way → arrived → delivered`; `cancelled` and `failed_delivery` are controlled terminal paths. Enforce the transition graph in a shared server service.

## Payment states
`unpaid`, `pending`, `processing`, `paid`, `failed`, `cancelled`, `refund_pending`, `refunded`, `partially_refunded`. Delivery completion never implies payment success.
