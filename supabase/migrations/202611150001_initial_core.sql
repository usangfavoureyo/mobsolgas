create extension if not exists postgis with schema extensions;

create type public.app_role as enum (
  'customer', 'rider', 'super_admin', 'operations_manager',
  'dispatcher', 'finance', 'inventory_manager', 'support_agent'
);
create type public.delivery_status as enum (
  'pending', 'confirmed', 'preparing', 'awaiting_rider', 'assigned',
  'accepted', 'on_the_way', 'arrived', 'delivered', 'cancelled', 'failed_delivery'
);
create type public.payment_status as enum (
  'unpaid', 'pending', 'processing', 'paid', 'failed', 'cancelled',
  'refund_pending', 'refunded', 'partially_refunded'
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  granted_at timestamptz not null default now(),
  primary key (user_id, role)
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  weight_kg integer not null check (weight_kg in (6, 12, 22)),
  description text not null default '',
  image_path text,
  price_kobo bigint not null check (price_kobo >= 0),
  available boolean not null default true,
  active boolean not null default true,
  display_order integer not null default 0,
  updated_at timestamptz not null default now()
);

create table public.delivery_zones (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  city text not null default 'Abuja',
  boundary extensions.geometry(MultiPolygon, 4326) not null,
  active boolean not null default false,
  created_at timestamptz not null default now()
);
create index delivery_zones_boundary_gix on public.delivery_zones using gist (boundary);

create table public.customer_addresses (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  address_text text not null,
  location extensions.geography(Point, 4326) not null,
  instructions text,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);
create index customer_addresses_customer_idx on public.customer_addresses(customer_id);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number bigint generated always as identity unique,
  customer_id uuid not null references auth.users(id),
  recipient_name text not null,
  recipient_phone text not null,
  address_id uuid references public.customer_addresses(id) on delete set null,
  delivery_address_snapshot text not null,
  delivery_location extensions.geography(Point, 4326) not null,
  delivery_zone_id uuid not null references public.delivery_zones(id),
  gas_subtotal_kobo bigint not null check (gas_subtotal_kobo >= 0),
  delivery_fee_kobo bigint not null check (delivery_fee_kobo >= 0),
  discount_kobo bigint not null default 0 check (discount_kobo >= 0),
  total_kobo bigint not null check (total_kobo >= 0),
  currency text not null default 'NGN' check (currency = 'NGN'),
  delivery_status public.delivery_status not null default 'pending',
  payment_status public.payment_status not null default 'unpaid',
  payment_method text check (payment_method in ('paystack', 'cash', 'pos')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index orders_customer_created_idx on public.orders(customer_id, created_at desc);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name_snapshot text not null,
  weight_kg_snapshot integer not null,
  unit_price_kobo bigint not null check (unit_price_kobo >= 0),
  quantity integer not null check (quantity > 0),
  line_total_kobo bigint not null check (line_total_kobo >= 0)
);

create table public.order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  from_status public.delivery_status,
  to_status public.delivery_status not null,
  actor_id uuid references auth.users(id),
  note text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.products enable row level security;
alter table public.delivery_zones enable row level security;
alter table public.customer_addresses enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_status_history enable row level security;

create policy "Users read own profile" on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy "Users update own profile" on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy "Users read own roles" on public.user_roles for select to authenticated using (user_id = (select auth.uid()));
create policy "Anyone reads active products" on public.products for select to anon, authenticated using (active and available);
create policy "Users manage own addresses" on public.customer_addresses for all to authenticated using (customer_id = (select auth.uid())) with check (customer_id = (select auth.uid()));
create policy "Customers read own orders" on public.orders for select to authenticated using (customer_id = (select auth.uid()));
create policy "Customers read own order items" on public.order_items for select to authenticated using (exists (select 1 from public.orders o where o.id = order_id and o.customer_id = (select auth.uid())));
create policy "Customers read own status history" on public.order_status_history for select to authenticated using (exists (select 1 from public.orders o where o.id = order_id and o.customer_id = (select auth.uid())));

-- Order creation, catalog administration, role grants and status transitions are server-side only.
-- Add staff and rider RLS policies alongside their tables in subsequent migrations.
