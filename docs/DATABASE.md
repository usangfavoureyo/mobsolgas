# Database and domain model

Supabase Auth is the identity source. All primary keys are UUIDs and timestamps use `timestamptz`. Create schema changes as ordered migrations; protect customer and rider data with RLS and enforce all transitions server-side.

## Core entities
- Identity and access: `profiles`, `user_roles`, `role_permissions`, `staff_members`, `riders`.
- Customer: `customer_addresses`, `recipient_contacts`, `customer_preferences`.
- Catalog and serviceability: `products`, `product_prices`, `delivery_zones`, `delivery_fees`.
- Orders: `orders`, `order_items`, `order_status_history`, `order_assignments`, `order_notes`.
- Rider operations: `rider_availability`, `rider_locations`, `rider_location_history` (with retention policy).
- Money: `payments`, `payment_events`, `payment_collections`, `payment_reconciliation`.
- Cylinders: `cylinders`, `cylinder_movements`, `inventory_locations`.
- Operations: `delivery_evidence`, `feedback`, `complaints`, `audit_logs`, `notifications`.

The initial core migration defines identity, products, delivery zones, addresses, orders and customer read policies. The backend foundation migration adds the remaining domain tables and role-specific read access. Order creation and lifecycle mutations remain server-only until validated server operations are implemented.

## Access model

- `user_roles` is the authorization source. Only trusted server-side code may grant or revoke a role; clients can read their own grants.
- A database trigger provisions a profile and the fixed `customer` role on Auth signup. It ignores user metadata for role assignment.
- `role_permissions` documents the seeded permission matrix. Server handlers must enforce the same permissions before writes.
- `staff_members` and `riders` are provisioned by trusted server code. No client can create a staff or rider record or self-assign a role.
- Customers can read their own orders, payment records, addresses, feedback, complaints, and notifications. They can manage only their own addresses, recipient contacts, and notification preferences.
- Riders can read only their own assignment and the `rider_delivery_jobs` row containing the recipient, destination, payment responsibility, and amount due for an assigned delivery. They do not receive direct order or payment record access.
- Dispatch and operations roles can read delivery and rider location data. Finance can read payment and reconciliation records. Inventory access is limited to inventory, operations, and super-admin roles. Support access is limited to customer/order and complaint work.
- Order creation, assignments, status transitions, payments, collections, rider location writes, cylinder movements, audit entries, and notification creation are server-only. Status history, cylinder movements, and audit logs are append-only.

The policies are a database boundary, not a substitute for authorization in route handlers or Edge Functions. Keep service-role credentials server-side and validate every requested transition before writing.

## Invariants
- A customer may read and change only their own profile, addresses and orders.
- A rider may read only jobs assigned to them and minimum recipient data needed to complete them.
- Staff access is role and permission scoped; administrative actions are audited.
- An order stores immutable gas price and delivery-fee snapshots. No cylinder deposit in initial MVP.
- Zone containment, price calculation, assignment locking and payment verification are server-side.
- Delivery lifecycle and payment lifecycle are separate. Cylinder movement history is append-only.
- Paystack references and webhook event identifiers are unique; webhook processing is idempotent.
