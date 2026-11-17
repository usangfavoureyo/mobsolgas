-- LOCAL DEVELOPMENT DATA ONLY. These test prices and the approximate polygon
-- are not Mobsol's approved prices or service boundaries. Never use in production.
do $$
declare
  demo_zone_id uuid;
  demo_location_id uuid;
begin
  insert into public.products (name, weight_kg, description, price_kobo, available, active, display_order)
  select demo.name, demo.weight_kg, demo.description, demo.price_kobo, true, true, demo.display_order
  from (values
    ('Mobsol 6 kg cylinder', 6, 'DEMO ONLY — compact kitchen size', 1200000::bigint, 1),
    ('Mobsol 12 kg cylinder', 12, 'DEMO ONLY — everyday family size', 2400000::bigint, 2),
    ('Mobsol 22 kg cylinder', 22, 'DEMO ONLY — larger household size', 4400000::bigint, 3)
  ) as demo(name, weight_kg, description, price_kobo, display_order)
  where not exists (
    select 1 from public.products p where p.weight_kg = demo.weight_kg
  );

  select z.id into demo_zone_id from public.delivery_zones z
  where z.name = 'DEMO ONLY — Abuja Core' limit 1;
  if demo_zone_id is null then
    insert into public.delivery_zones (name, city, boundary, active)
    values (
      'DEMO ONLY — Abuja Core', 'Abuja',
      extensions.st_geomfromtext(
        'MULTIPOLYGON(((7.35 8.95, 7.65 8.95, 7.65 9.18, 7.35 9.18, 7.35 8.95)))', 4326
      ), true
    ) returning id into demo_zone_id;
  end if;

  if not exists (
    select 1 from public.delivery_fees f
    where f.zone_id = demo_zone_id and f.active and f.fee_kobo = 150000
  ) then
    insert into public.delivery_fees (zone_id, fee_kobo, active)
    values (demo_zone_id, 150000, true);
  end if;

  select l.id into demo_location_id from public.inventory_locations l
  where l.name = 'DEMO ONLY — Abuja Depot' limit 1;
  if demo_location_id is null then
    insert into public.inventory_locations (name, location_type, address)
    values ('DEMO ONLY — Abuja Depot', 'depot', 'Local development fixture')
    returning id into demo_location_id;
  end if;

  insert into public.cylinders (cylinder_code, weight_kg, state, current_location_id)
  values
    ('DEMO-6KG-001', 6, 'full', demo_location_id),
    ('DEMO-12KG-001', 12, 'full', demo_location_id),
    ('DEMO-22KG-001', 22, 'full', demo_location_id)
  on conflict (cylinder_code) do nothing;
end;
$$;
