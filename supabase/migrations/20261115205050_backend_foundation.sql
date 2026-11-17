begin;

-- Role permissions are seeded configuration. Role grants themselves are only
-- managed by trusted server-side code; clients can never grant themselves a role.
create table public.role_permissions (
  role public.app_role not null,
  permission_key text not null,
  primary key (role, permission_key)
);

insert into public.role_permissions (role, permission_key) values
  ('super_admin', 'staff.manage'), ('super_admin', 'orders.read'), ('super_admin', 'orders.manage'),
  ('super_admin', 'dispatch.manage'), ('super_admin', 'catalog.manage'), ('super_admin', 'zones.manage'),
  ('super_admin', 'inventory.manage'), ('super_admin', 'payments.read'), ('super_admin', 'payments.reconcile'),
  ('super_admin', 'customers.read'), ('super_admin', 'support.manage'), ('super_admin', 'audit.read'),
  ('operations_manager', 'orders.read'), ('operations_manager', 'orders.manage'), ('operations_manager', 'dispatch.manage'),
  ('operations_manager', 'catalog.manage'), ('operations_manager', 'zones.manage'), ('operations_manager', 'inventory.manage'),
  ('operations_manager', 'customers.read'), ('operations_manager', 'support.manage'),
  ('dispatcher', 'orders.read'), ('dispatcher', 'dispatch.manage'), ('dispatcher', 'customers.read'),
  ('finance', 'payments.read'), ('finance', 'payments.reconcile'),
  ('inventory_manager', 'catalog.manage'), ('inventory_manager', 'inventory.manage'),
  ('support_agent', 'orders.read'), ('support_agent', 'customers.read'), ('support_agent', 'support.manage'),
  ('rider', 'deliveries.read'), ('rider', 'deliveries.update'), ('rider', 'collections.record');

create table public.staff_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  employee_code text unique,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.riders (
  user_id uuid primary key references auth.users(id) on delete cascade,
  rider_code text not null unique,
  active boolean not null default true,
  vehicle_description text,
  emergency_contact_name text,
  emergency_contact_phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.customer_preferences (
  customer_id uuid primary key references auth.users(id) on delete cascade,
  notification_push boolean not null default true,
  notification_sms boolean not null default true,
  notification_email boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.recipient_contacts (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references auth.users(id) on delete cascade,
  full_name text not null,
  phone text not null,
  relationship_label text,
  created_at timestamptz not null default now(),
  unique (customer_id, phone)
);
create index recipient_contacts_customer_idx on public.recipient_contacts(customer_id);

create table public.delivery_fees (
  id uuid primary key default gen_random_uuid(),
  zone_id uuid not null references public.delivery_zones(id) on delete cascade,
  fee_kobo bigint not null check (fee_kobo >= 0),
  active boolean not null default true,
  effective_from timestamptz not null default now(),
  effective_until timestamptz,
  created_at timestamptz not null default now(),
  check (effective_until is null or effective_until > effective_from)
);
create index delivery_fees_zone_active_idx on public.delivery_fees(zone_id, active, effective_from desc);

alter table public.orders
  add column payer_party text not null default 'customer' check (payer_party in ('customer', 'recipient')),
  add column scheduled_for timestamptz,
  add column confirmed_at timestamptz,
  add column cancelled_at timestamptz;

create table public.order_assignments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  rider_id uuid not null references public.riders(user_id),
  assigned_by uuid references auth.users(id),
  assigned_at timestamptz not null default now(),
  unassigned_at timestamptz,
  unassigned_by uuid references auth.users(id),
  note text,
  check (unassigned_at is null or unassigned_at >= assigned_at)
);
create unique index order_assignments_one_active_idx on public.order_assignments(order_id) where unassigned_at is null;
create index order_assignments_rider_active_idx on public.order_assignments(rider_id, assigned_at desc) where unassigned_at is null;
create index order_assignments_order_idx on public.order_assignments(order_id, assigned_at desc);

-- This intentionally contains only the recipient and destination data needed
-- for an assigned delivery. Riders do not receive direct order/payment access.
create table public.rider_delivery_jobs (
  order_id uuid primary key references public.orders(id) on delete cascade,
  rider_id uuid not null references public.riders(user_id),
  order_number bigint not null,
  recipient_name text not null,
  recipient_phone text not null,
  delivery_address text not null,
  delivery_latitude double precision not null check (delivery_latitude between -90 and 90),
  delivery_longitude double precision not null check (delivery_longitude between -180 and 180),
  delivery_instructions text,
  payer_party text not null check (payer_party in ('customer', 'recipient')),
  payment_method text check (payment_method in ('paystack', 'cash', 'pos')),
  amount_due_kobo bigint not null check (amount_due_kobo >= 0),
  delivery_status public.delivery_status not null,
  assigned_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index rider_delivery_jobs_rider_status_idx on public.rider_delivery_jobs(rider_id, delivery_status);

create table public.order_notes (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  author_id uuid references auth.users(id),
  note text not null,
  customer_visible boolean not null default false,
  created_at timestamptz not null default now()
);
create index order_notes_order_created_idx on public.order_notes(order_id, created_at);

create table public.delivery_evidence (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  rider_id uuid not null references public.riders(user_id),
  evidence_type text not null check (evidence_type in ('delivery_photo', 'customer_confirmation', 'otp_confirmation', 'exchange_photo', 'other')),
  storage_path text not null,
  captured_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index delivery_evidence_order_idx on public.delivery_evidence(order_id, captured_at desc);
create index delivery_evidence_rider_idx on public.delivery_evidence(rider_id, captured_at desc);

create table public.rider_availability (
  rider_id uuid primary key references public.riders(user_id) on delete cascade,
  available boolean not null default false,
  last_changed_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.rider_locations (
  rider_id uuid primary key references public.riders(user_id) on delete cascade,
  location extensions.geography(Point, 4326) not null,
  accuracy_meters real check (accuracy_meters is null or accuracy_meters >= 0),
  recorded_at timestamptz not null default now()
);
create index rider_locations_location_gix on public.rider_locations using gist (location);

create table public.rider_location_history (
  id bigint generated always as identity primary key,
  rider_id uuid not null references public.riders(user_id) on delete cascade,
  location extensions.geography(Point, 4326) not null,
  accuracy_meters real check (accuracy_meters is null or accuracy_meters >= 0),
  recorded_at timestamptz not null default now()
);
create index rider_location_history_rider_recorded_idx on public.rider_location_history(rider_id, recorded_at desc);
create index rider_location_history_location_gix on public.rider_location_history using gist (location);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  provider text not null check (provider in ('paystack', 'cash', 'pos')),
  provider_reference text unique,
  amount_kobo bigint not null check (amount_kobo >= 0),
  currency text not null default 'NGN' check (currency = 'NGN'),
  status public.payment_status not null default 'pending',
  payer_party text not null check (payer_party in ('customer', 'recipient')),
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index payments_order_created_idx on public.payments(order_id, created_at desc);
create index payments_status_created_idx on public.payments(status, created_at desc);

create table public.payment_events (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid references public.payments(id) on delete set null,
  provider text not null,
  provider_event_id text not null,
  event_type text not null,
  signature_valid boolean not null default false,
  processing_error text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (provider, provider_event_id)
);
create index payment_events_payment_idx on public.payment_events(payment_id, received_at desc);

create table public.payment_collections (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  rider_id uuid not null references public.riders(user_id),
  method text not null check (method in ('cash', 'pos')),
  amount_kobo bigint not null check (amount_kobo >= 0),
  reference text,
  collected_at timestamptz not null default now(),
  recorded_at timestamptz not null default now()
);
create index payment_collections_order_idx on public.payment_collections(order_id, collected_at desc);
create index payment_collections_rider_idx on public.payment_collections(rider_id, collected_at desc);

create table public.payment_reconciliation (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null unique references public.payment_collections(id) on delete restrict,
  reconciled_by uuid not null references auth.users(id),
  amount_kobo bigint not null check (amount_kobo >= 0),
  variance_kobo bigint not null default 0,
  note text,
  reconciled_at timestamptz not null default now()
);

create table public.inventory_locations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  location_type text not null check (location_type in ('depot', 'vehicle', 'other')),
  address text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.cylinders (
  id uuid primary key default gen_random_uuid(),
  cylinder_code text not null unique,
  weight_kg integer not null check (weight_kg in (6, 12, 22)),
  condition text not null default 'good' check (condition in ('good', 'needs_inspection', 'damaged', 'retired')),
  state text not null default 'empty' check (state in ('full', 'empty', 'with_rider', 'at_depot', 'unavailable', 'retired')),
  current_location_id uuid references public.inventory_locations(id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index cylinders_state_location_idx on public.cylinders(state, current_location_id);

create table public.cylinder_movements (
  id uuid primary key default gen_random_uuid(),
  cylinder_id uuid not null references public.cylinders(id) on delete restrict,
  movement_type text not null check (movement_type in ('stock_in', 'load_to_rider', 'delivered_full', 'collected_empty', 'returned_to_depot', 'condition_change', 'adjustment')),
  from_location_id uuid references public.inventory_locations(id),
  to_location_id uuid references public.inventory_locations(id),
  rider_id uuid references public.riders(user_id),
  order_id uuid references public.orders(id),
  condition_before text,
  condition_after text,
  note text,
  actor_id uuid references auth.users(id),
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index cylinder_movements_cylinder_idx on public.cylinder_movements(cylinder_id, occurred_at desc);
create index cylinder_movements_order_idx on public.cylinder_movements(order_id) where order_id is not null;

create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references auth.users(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  rating smallint check (rating between 1 and 5),
  message text not null,
  created_at timestamptz not null default now()
);
create index feedback_customer_created_idx on public.feedback(customer_id, created_at desc);

create table public.complaints (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references auth.users(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  category text not null,
  subject text not null,
  message text not null,
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved', 'closed')),
  assigned_to uuid references auth.users(id),
  resolution_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index complaints_status_created_idx on public.complaints(status, created_at desc);
create index complaints_customer_created_idx on public.complaints(customer_id, created_at desc);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id),
  action text not null,
  entity_type text not null,
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_entity_created_idx on public.audit_logs(entity_type, entity_id, created_at desc);
create index audit_logs_actor_created_idx on public.audit_logs(actor_id, created_at desc);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body text not null,
  channel text not null default 'in_app' check (channel in ('in_app', 'push', 'sms', 'email')),
  read_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_unread_idx on public.notifications(user_id, created_at desc) where read_at is null;

create function public.reject_immutable_row_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception '% rows are append-only', tg_table_name using errcode = '55000';
end;
$$;
revoke all on function public.reject_immutable_row_mutation() from public, anon, authenticated;
create trigger order_status_history_append_only before update or delete on public.order_status_history
  for each row execute function public.reject_immutable_row_mutation();
create trigger cylinder_movements_append_only before update or delete on public.cylinder_movements
  for each row execute function public.reject_immutable_row_mutation();
create trigger audit_logs_append_only before update or delete on public.audit_logs
  for each row execute function public.reject_immutable_row_mutation();

-- Authorization helper is SECURITY INVOKER. The user_roles self-read policy
-- below limits the lookup to the caller's own grants and avoids RLS recursion.
create function public.has_app_role(required_roles public.app_role[])
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles ur
    where ur.user_id = (select auth.uid())
      and ur.role = any(required_roles)
  );
$$;
revoke all on function public.has_app_role(public.app_role[]) from public, anon;
grant execute on function public.has_app_role(public.app_role[]) to authenticated;

-- RLS is enabled on every new public table.
alter table public.role_permissions enable row level security;
alter table public.staff_members enable row level security;
alter table public.riders enable row level security;
alter table public.customer_preferences enable row level security;
alter table public.recipient_contacts enable row level security;
alter table public.delivery_fees enable row level security;
alter table public.order_assignments enable row level security;
alter table public.rider_delivery_jobs enable row level security;
alter table public.order_notes enable row level security;
alter table public.delivery_evidence enable row level security;
alter table public.rider_availability enable row level security;
alter table public.rider_locations enable row level security;
alter table public.rider_location_history enable row level security;
alter table public.payments enable row level security;
alter table public.payment_events enable row level security;
alter table public.payment_collections enable row level security;
alter table public.payment_reconciliation enable row level security;
alter table public.inventory_locations enable row level security;
alter table public.cylinders enable row level security;
alter table public.cylinder_movements enable row level security;
alter table public.feedback enable row level security;
alter table public.complaints enable row level security;
alter table public.audit_logs enable row level security;
alter table public.notifications enable row level security;

-- Strip default API grants first, then grant only the access required by each client.
revoke all on public.role_permissions, public.staff_members, public.riders,
  public.customer_preferences, public.recipient_contacts, public.delivery_fees,
  public.order_assignments, public.rider_delivery_jobs, public.order_notes,
  public.delivery_evidence,
  public.rider_availability, public.rider_locations, public.rider_location_history,
  public.payments, public.payment_events, public.payment_collections,
  public.payment_reconciliation, public.inventory_locations, public.cylinders,
  public.cylinder_movements, public.feedback, public.complaints, public.audit_logs,
  public.notifications from anon, authenticated;
revoke all on public.orders, public.order_items, public.order_status_history,
  public.user_roles, public.products, public.delivery_zones,
  public.customer_addresses, public.profiles
  from anon, authenticated;

grant select on public.role_permissions, public.staff_members, public.riders,
  public.customer_preferences, public.recipient_contacts, public.order_assignments,
  public.rider_delivery_jobs, public.order_notes, public.delivery_evidence, public.rider_availability,
  public.rider_locations, public.rider_location_history, public.payments,
  public.payment_collections, public.payment_reconciliation, public.inventory_locations,
  public.cylinders, public.cylinder_movements, public.feedback, public.complaints,
  public.audit_logs, public.notifications to authenticated;
grant insert on public.feedback, public.complaints to authenticated;
grant update (read_at) on public.notifications to authenticated;
grant update on public.customer_preferences, public.recipient_contacts to authenticated;
grant insert, update, delete on public.customer_preferences, public.recipient_contacts to authenticated;
grant select, insert, update, delete on public.customer_addresses to authenticated;
grant select, update on public.profiles to authenticated;
grant select on public.user_roles, public.products, public.orders,
  public.order_items, public.order_status_history to authenticated;
grant select on public.products to anon;
grant all on public.role_permissions, public.staff_members, public.riders,
  public.customer_preferences, public.recipient_contacts, public.delivery_fees,
  public.order_assignments, public.rider_delivery_jobs, public.order_notes,
  public.delivery_evidence,
  public.rider_availability, public.rider_locations, public.rider_location_history,
  public.payments, public.payment_events, public.payment_collections,
  public.payment_reconciliation, public.inventory_locations, public.cylinders,
  public.cylinder_movements, public.feedback, public.complaints, public.audit_logs,
  public.notifications to service_role;

-- Staff-only reference and operations data.
create policy role_permissions_staff_read on public.role_permissions for select to authenticated
  using (public.has_app_role(array['super_admin','operations_manager','dispatcher','finance','inventory_manager','support_agent']::public.app_role[]));
create policy staff_members_admin_read on public.staff_members for select to authenticated
  using (public.has_app_role(array['super_admin']::public.app_role[]));
create policy riders_staff_read on public.riders for select to authenticated
  using (user_id = (select auth.uid()) or public.has_app_role(array['super_admin','operations_manager','dispatcher']::public.app_role[]));
create policy customer_preferences_owner_all on public.customer_preferences for all to authenticated
  using (customer_id = (select auth.uid())) with check (customer_id = (select auth.uid()));
create policy recipient_contacts_owner_all on public.recipient_contacts for all to authenticated
  using (customer_id = (select auth.uid())) with check (customer_id = (select auth.uid()));

create policy staff_addresses_read on public.customer_addresses for select to authenticated
  using (public.has_app_role(array['super_admin','operations_manager','dispatcher','support_agent']::public.app_role[]));
create policy staff_orders_read on public.orders for select to authenticated
  using (public.has_app_role(array['super_admin','operations_manager','dispatcher','support_agent']::public.app_role[]));
create policy staff_order_items_read on public.order_items for select to authenticated
  using (public.has_app_role(array['super_admin','operations_manager','dispatcher','support_agent']::public.app_role[]));
create policy staff_order_history_read on public.order_status_history for select to authenticated
  using (public.has_app_role(array['super_admin','operations_manager','dispatcher','support_agent']::public.app_role[]));
create policy order_assignments_staff_read on public.order_assignments for select to authenticated
  using (public.has_app_role(array['super_admin','operations_manager','dispatcher']::public.app_role[]));
create policy order_assignments_rider_read on public.order_assignments for select to authenticated
  using (rider_id = (select auth.uid()));
create policy rider_jobs_assignee_read on public.rider_delivery_jobs for select to authenticated
  using (rider_id = (select auth.uid()) or public.has_app_role(array['super_admin','operations_manager','dispatcher']::public.app_role[]));
create policy order_notes_staff_read on public.order_notes for select to authenticated
  using (public.has_app_role(array['super_admin','operations_manager','dispatcher','support_agent']::public.app_role[]));
create policy delivery_evidence_staff_read on public.delivery_evidence for select to authenticated
  using (public.has_app_role(array['super_admin','operations_manager','dispatcher','support_agent']::public.app_role[]));
create policy delivery_evidence_customer_read on public.delivery_evidence for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id and o.customer_id = (select auth.uid())));
create policy delivery_evidence_rider_read on public.delivery_evidence for select to authenticated
  using (rider_id = (select auth.uid()));
create policy rider_availability_own_read on public.rider_availability for select to authenticated
  using (rider_id = (select auth.uid()) or public.has_app_role(array['super_admin','operations_manager','dispatcher']::public.app_role[]));
create policy rider_locations_scoped_read on public.rider_locations for select to authenticated
  using (rider_id = (select auth.uid()) or public.has_app_role(array['super_admin','operations_manager','dispatcher']::public.app_role[]));
create policy rider_location_history_scoped_read on public.rider_location_history for select to authenticated
  using (rider_id = (select auth.uid()) or public.has_app_role(array['super_admin','operations_manager','dispatcher']::public.app_role[]));

create policy payments_finance_read on public.payments for select to authenticated
  using (public.has_app_role(array['super_admin','finance']::public.app_role[]));
create policy payments_customer_read on public.payments for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id and o.customer_id = (select auth.uid())));
create policy payment_events_finance_read on public.payment_events for select to authenticated
  using (public.has_app_role(array['super_admin','finance']::public.app_role[]));
create policy payment_collections_finance_read on public.payment_collections for select to authenticated
  using (public.has_app_role(array['super_admin','finance','operations_manager']::public.app_role[]));
create policy payment_collections_rider_read on public.payment_collections for select to authenticated
  using (rider_id = (select auth.uid()));
create policy payment_reconciliation_finance_read on public.payment_reconciliation for select to authenticated
  using (public.has_app_role(array['super_admin','finance']::public.app_role[]));

create policy inventory_locations_staff_read on public.inventory_locations for select to authenticated
  using (public.has_app_role(array['super_admin','operations_manager','inventory_manager']::public.app_role[]));
create policy cylinders_inventory_read on public.cylinders for select to authenticated
  using (public.has_app_role(array['super_admin','operations_manager','inventory_manager']::public.app_role[]));
create policy cylinder_movements_inventory_read on public.cylinder_movements for select to authenticated
  using (public.has_app_role(array['super_admin','operations_manager','inventory_manager']::public.app_role[]));

create policy feedback_owner_read on public.feedback for select to authenticated
  using (customer_id = (select auth.uid()));
create policy feedback_owner_insert on public.feedback for insert to authenticated
  with check (customer_id = (select auth.uid()) and (order_id is null or exists (
    select 1 from public.orders o where o.id = order_id and o.customer_id = (select auth.uid())
  )));
create policy feedback_support_read on public.feedback for select to authenticated
  using (public.has_app_role(array['super_admin','operations_manager','support_agent']::public.app_role[]));
create policy complaints_owner_read on public.complaints for select to authenticated
  using (customer_id = (select auth.uid()));
create policy complaints_owner_insert on public.complaints for insert to authenticated
  with check (customer_id = (select auth.uid()) and (order_id is null or exists (
    select 1 from public.orders o where o.id = order_id and o.customer_id = (select auth.uid())
  )));
create policy complaints_support_read on public.complaints for select to authenticated
  using (public.has_app_role(array['super_admin','operations_manager','support_agent']::public.app_role[]));
create policy complaints_support_update on public.complaints for update to authenticated
  using (public.has_app_role(array['super_admin','operations_manager','support_agent']::public.app_role[]))
  with check (public.has_app_role(array['super_admin','operations_manager','support_agent']::public.app_role[]));
grant update (status, assigned_to, resolution_note, updated_at) on public.complaints to authenticated;
create policy audit_logs_admin_read on public.audit_logs for select to authenticated
  using (public.has_app_role(array['super_admin']::public.app_role[]));
create policy notifications_owner_read on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));
create policy notifications_owner_mark_read on public.notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Customers may read only their own orders; rider details are served through
-- rider_delivery_jobs, which omits the full order record and payment records.
create policy orders_customer_read on public.orders for select to authenticated
  using (customer_id = (select auth.uid()));
create policy order_items_customer_read on public.order_items for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id and o.customer_id = (select auth.uid())));
create policy order_history_customer_read on public.order_status_history for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id and o.customer_id = (select auth.uid())));
create policy addresses_owner_select on public.customer_addresses for select to authenticated
  using (customer_id = (select auth.uid()));
create policy addresses_owner_insert on public.customer_addresses for insert to authenticated
  with check (customer_id = (select auth.uid()));
create policy addresses_owner_update on public.customer_addresses for update to authenticated
  using (customer_id = (select auth.uid())) with check (customer_id = (select auth.uid()));
create policy addresses_owner_delete on public.customer_addresses for delete to authenticated
  using (customer_id = (select auth.uid()));
create policy profiles_owner_select on public.profiles for select to authenticated
  using (id = (select auth.uid()));
create policy profiles_owner_update on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy user_roles_owner_select on public.user_roles for select to authenticated
  using (user_id = (select auth.uid()));
create policy products_public_active_read on public.products for select to anon, authenticated
  using (active and available);

-- Order writes, role grants, payment updates, delivery transitions, rider GPS,
-- inventory movements, audit entries, and notification creation remain server-only.

commit;
