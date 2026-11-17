begin;

create table public.gas_rates (
  id uuid primary key default gen_random_uuid(),
  price_per_kg_kobo bigint not null check (price_per_kg_kobo > 0),
  currency text not null default 'NGN' check (currency = 'NGN'),
  effective_from timestamptz not null default now(),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index gas_rates_current_idx on public.gas_rates(active, effective_from desc);
alter table public.gas_rates enable row level security;
grant select on public.gas_rates to anon, authenticated;
create policy gas_rates_public_read on public.gas_rates for select to anon, authenticated
  using (active and effective_from <= now());

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'gas_rates'
    ) then
    alter publication supabase_realtime add table public.gas_rates;
  end if;
end;
$$;

insert into public.gas_rates(price_per_kg_kobo, effective_from)
values (200000, now());

create function public.apply_current_gas_rate_to_products()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_rate bigint;
begin
  select r.price_per_kg_kobo into v_rate
  from public.gas_rates r
  where r.active and r.effective_from <= now()
  order by r.effective_from desc
  limit 1;
  if v_rate is not null then
    update public.products set price_kobo = weight_kg * v_rate, updated_at = now();
  end if;
  return new;
end;
$$;
create trigger gas_rates_update_product_prices
  after insert or update of price_per_kg_kobo, active, effective_from on public.gas_rates
  for each row execute function public.apply_current_gas_rate_to_products();

update public.products p
set price_kobo = p.weight_kg * 200000, updated_at = now();

-- The app supports Paystack card and bank transfer through Paystack Checkout.
-- Raw card details are never sent to or stored by Mobsol.
commit;
