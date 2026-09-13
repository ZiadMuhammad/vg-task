-- M2: authorization is database-owned, independent of application routes.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated, service_role;
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke execute on functions from public, anon, authenticated;
alter default privileges for role postgres in schema private revoke execute on functions from public, anon, authenticated;

create table public.brands (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code in ('KILELE','KAROO','MARRAKECH')),
  name text not null,
  country text not null check (country ~ '^[A-Z]{2}$'),
  timezone text not null,
  created_at timestamptz not null default now()
);
create table public.memberships (
  user_id uuid primary key references auth.users(id) on delete cascade,
  brand_id uuid not null references public.brands(id),
  role text not null check (role in ('owner','analyst')),
  display_name text not null,
  unique (brand_id, role)
);
create index memberships_brand_id_idx on public.memberships(brand_id);

create function private.current_brand_id() returns uuid
language sql stable security definer set search_path = ''
as $$ select brand_id from public.memberships where user_id = (select auth.uid()) $$;
create function private.require_owner(p_brand_id uuid) returns void
language plpgsql stable security definer set search_path = ''
as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.memberships where user_id = auth.uid() and brand_id = p_brand_id and role = 'owner'
  ) then raise exception 'Owner access required' using errcode = '42501'; end if;
end $$;
grant execute on function private.current_brand_id(), private.require_owner(uuid) to authenticated;

alter table public.brands enable row level security;
alter table public.memberships enable row level security;
create policy brands_read on public.brands for select to authenticated using (id = (select private.current_brand_id()));
create policy membership_read on public.memberships for select to authenticated using (user_id = (select auth.uid()));
grant select on public.brands, public.memberships to authenticated;
grant all on public.brands, public.memberships to service_role;

insert into public.brands(id,code,name,country,timezone) values
 ('11111111-1111-4111-8111-111111111111','KILELE','Kilele Rides','KE','Africa/Nairobi'),
 ('22222222-2222-4222-8222-222222222222','KAROO','Karoo Coaches','ZA','Africa/Johannesburg'),
 ('33333333-3333-4333-8333-333333333333','MARRAKECH','Marrakech Express','MA','Africa/Casablanca');
