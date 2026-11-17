begin;

create function public.mobsol_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (
    new.id,
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''), ''),
    new.phone
  )
  on conflict (id) do nothing;

  -- Role assignment is fixed here; user-editable metadata never grants access.
  insert into public.user_roles (user_id, role)
  values (new.id, 'customer'::public.app_role)
  on conflict (user_id, role) do nothing;
  return new;
end;
$$;
revoke all on function public.mobsol_handle_new_user() from public, anon, authenticated, service_role;
create trigger mobsol_handle_new_user_after_insert
  after insert on auth.users
  for each row execute function public.mobsol_handle_new_user();

alter table public.orders add column client_request_id uuid;
create unique index orders_customer_request_id_idx
  on public.orders(customer_id, client_request_id)
  where client_request_id is not null;

create function public.create_customer_order(
  p_customer_id uuid,
  p_request_id uuid,
  p_items jsonb,
  p_address_id uuid,
  p_address_text text,
  p_latitude double precision,
  p_longitude double precision,
  p_instructions text,
  p_recipient_name text,
  p_recipient_phone text,
  p_payer_party text,
  p_payment_method text,
  p_scheduled_for timestamptz default null
)
returns table (
  id uuid,
  order_number bigint,
  gas_subtotal_kobo bigint,
  delivery_fee_kobo bigint,
  discount_kobo bigint,
  total_kobo bigint,
  delivery_status public.delivery_status,
  payment_status public.payment_status
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer_name text;
  v_customer_phone text;
  v_recipient_name text;
  v_recipient_phone text;
  v_address_text text;
  v_instructions text;
  v_point extensions.geometry(Point, 4326);
  v_zone public.delivery_zones%rowtype;
  v_fee public.delivery_fees%rowtype;
  v_product public.products%rowtype;
  v_item jsonb;
  v_product_id uuid;
  v_quantity integer;
  v_gas_subtotal bigint := 0;
  v_delivery_fee bigint;
  v_total bigint;
  v_order_id uuid;
  v_order_number bigint;
  v_payment_status public.payment_status;
begin
  if p_customer_id is null or p_request_id is null then
    raise exception using errcode = 'P0001', message = 'A valid customer and idempotency key are required.';
  end if;

  return query
  select o.id, o.order_number, o.gas_subtotal_kobo, o.delivery_fee_kobo,
    o.discount_kobo, o.total_kobo, o.delivery_status, o.payment_status
  from public.orders o
  where o.customer_id = p_customer_id and o.client_request_id = p_request_id;
  if found then return; end if;

  if p_payer_party is null or p_payer_party not in ('customer', 'recipient') then
    raise exception using errcode = 'P0001', message = 'Choose who will pay.';
  end if;
  if p_payment_method is null or p_payment_method not in ('paystack', 'cash', 'pos') then
    raise exception using errcode = 'P0001', message = 'Choose an available payment method.';
  end if;
  if p_payer_party = 'recipient' and p_payment_method = 'paystack' then
    raise exception using errcode = 'P0001', message = 'Recipient payment is available on delivery only.';
  end if;
  if p_scheduled_for is not null and p_scheduled_for <= now() then
    raise exception using errcode = 'P0001', message = 'Choose a future delivery time.';
  end if;
  if jsonb_typeof(p_items) is distinct from 'array' then
    raise exception using errcode = 'P0001', message = 'Your cart is invalid.';
  end if;
  if jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 3 then
    raise exception using errcode = 'P0001', message = 'Your cart is invalid.';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_items) as item(value)
    group by item.value ->> 'product_id'
    having count(*) > 1
  ) then
    raise exception using errcode = 'P0001', message = 'Each cylinder size can appear only once in the cart.';
  end if;

  select p.full_name, p.phone into v_customer_name, v_customer_phone
  from public.profiles p where p.id = p_customer_id;
  if not found then
    raise exception using errcode = 'P0001', message = 'Complete your profile before ordering.';
  end if;

  if p_address_id is not null then
    select a.address_text, a.location::extensions.geometry, a.instructions
      into v_address_text, v_point, v_instructions
    from public.customer_addresses a
    where a.id = p_address_id and a.customer_id = p_customer_id
    for share;
    if not found then
      raise exception using errcode = 'P0001', message = 'That saved address is unavailable.';
    end if;
    v_instructions := coalesce(nullif(btrim(p_instructions), ''), v_instructions);
  else
    if nullif(btrim(p_address_text), '') is null
       or p_latitude is null or p_longitude is null
       or p_latitude < -90 or p_latitude > 90
       or p_longitude < -180 or p_longitude > 180 then
      raise exception using errcode = 'P0001', message = 'Enter a valid delivery address and map location.';
    end if;
    v_address_text := btrim(p_address_text);
    v_point := extensions.st_setsrid(extensions.st_makepoint(p_longitude, p_latitude), 4326);
    v_instructions := nullif(btrim(p_instructions), '');
  end if;

  if v_point is null then
    raise exception using errcode = 'P0001', message = 'A map location is required for delivery.';
  end if;

  select z.* into v_zone
  from public.delivery_zones z
  where z.active
    and extensions.st_covers(z.boundary, v_point)
  order by z.created_at desc
  limit 1
  for share;
  if not found then
    raise exception using errcode = 'P0001', message = 'This address is outside Mobsol’s active delivery areas.';
  end if;

  select f.* into v_fee
  from public.delivery_fees f
  where f.zone_id = v_zone.id
    and f.active
    and f.effective_from <= now()
    and (f.effective_until is null or f.effective_until > now())
  order by f.effective_from desc
  limit 1
  for share;
  if not found then
    raise exception using errcode = 'P0001', message = 'Delivery pricing is not configured for this area.';
  end if;
  v_delivery_fee := v_fee.fee_kobo;

  for v_item in select item.value from jsonb_array_elements(p_items) as item(value)
  loop
    begin
      v_product_id := (v_item ->> 'product_id')::uuid;
      v_quantity := (v_item ->> 'quantity')::integer;
    exception when others then
      raise exception using errcode = 'P0001', message = 'Your cart contains an invalid item.';
    end;

    if v_quantity < 1 or v_quantity > 10 then
      raise exception using errcode = 'P0001', message = 'Cylinder quantity must be between 1 and 10.';
    end if;

    select p.* into v_product
    from public.products p
    where p.id = v_product_id and p.active and p.available
    for share;
    if not found then
      raise exception using errcode = 'P0001', message = 'A selected cylinder is no longer available.';
    end if;
    v_gas_subtotal := v_gas_subtotal + (v_product.price_kobo * v_quantity);
  end loop;

  v_total := v_gas_subtotal + v_delivery_fee;
  v_payment_status := case when p_payment_method = 'paystack' then 'pending'::public.payment_status
                           else 'unpaid'::public.payment_status end;

  v_recipient_name := nullif(btrim(p_recipient_name), '');
  v_recipient_phone := nullif(btrim(p_recipient_phone), '');
  if v_recipient_name is null then v_recipient_name := nullif(btrim(v_customer_name), ''); end if;
  if v_recipient_phone is null then v_recipient_phone := nullif(btrim(v_customer_phone), ''); end if;
  if v_recipient_name is null or length(v_recipient_name) < 2
     or v_recipient_phone is null or length(regexp_replace(v_recipient_phone, '[^0-9]', '', 'g')) < 7 then
    raise exception using errcode = 'P0001', message = 'Enter the recipient’s name and a valid phone number.';
  end if;

  insert into public.orders as new_order (
    customer_id, recipient_name, recipient_phone, address_id,
    delivery_address_snapshot, delivery_location, delivery_zone_id,
    gas_subtotal_kobo, delivery_fee_kobo, discount_kobo, total_kobo,
    delivery_status, payment_status, payment_method, payer_party, scheduled_for, client_request_id
  ) values (
    p_customer_id, v_recipient_name, v_recipient_phone, p_address_id,
    v_address_text, v_point::extensions.geography, v_zone.id,
    v_gas_subtotal, v_delivery_fee, 0, v_total,
    'pending', v_payment_status, p_payment_method, p_payer_party, p_scheduled_for, p_request_id
  ) returning new_order.id, new_order.order_number into v_order_id, v_order_number;

  for v_item in select item.value from jsonb_array_elements(p_items) as item(value)
  loop
    v_product_id := (v_item ->> 'product_id')::uuid;
    v_quantity := (v_item ->> 'quantity')::integer;
    select p.* into v_product from public.products p where p.id = v_product_id;
    insert into public.order_items (
      order_id, product_id, product_name_snapshot, weight_kg_snapshot,
      unit_price_kobo, quantity, line_total_kobo
    ) values (
      v_order_id, v_product.id, v_product.name, v_product.weight_kg,
      v_product.price_kobo, v_quantity, v_product.price_kobo * v_quantity
    );
  end loop;

  insert into public.order_status_history (order_id, from_status, to_status, actor_id, note)
  values (v_order_id, null, 'pending', p_customer_id, 'Order placed');

  insert into public.payments (order_id, provider, amount_kobo, currency, status, payer_party)
  values (v_order_id, p_payment_method, v_total, 'NGN', v_payment_status, p_payer_party);

  return query select v_order_id, v_order_number, v_gas_subtotal,
    v_delivery_fee, 0::bigint, v_total, 'pending'::public.delivery_status, v_payment_status;
exception when unique_violation then
  return query
  select o.id, o.order_number, o.gas_subtotal_kobo, o.delivery_fee_kobo,
    o.discount_kobo, o.total_kobo, o.delivery_status, o.payment_status
  from public.orders o
  where o.customer_id = p_customer_id and o.client_request_id = p_request_id;
  if not found then raise; end if;
end;
$$;

revoke all on function public.create_customer_order(
  uuid, uuid, jsonb, uuid, text, double precision, double precision, text,
  text, text, text, text, timestamptz
) from public, anon, authenticated;
grant execute on function public.create_customer_order(
  uuid, uuid, jsonb, uuid, text, double precision, double precision, text,
  text, text, text, text, timestamptz
) to service_role;

commit;
