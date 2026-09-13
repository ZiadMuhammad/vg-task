-- Run against a migrated database. All fixtures and attempted changes roll back.
-- Removing RLS on brands or memberships makes these assertions fail.
begin;
delete from public.memberships;
insert into auth.users(id, email) values
 ('00000000-0000-4000-8000-000000000001','isolation-owner@example.test'),
 ('00000000-0000-4000-8000-000000000002','isolation-analyst@example.test'),
 ('00000000-0000-4000-8000-000000000003','isolation-outsider@example.test');
insert into public.memberships(user_id,brand_id,role,display_name) values
 ('00000000-0000-4000-8000-000000000001','11111111-1111-4111-8111-111111111111','owner','Test owner'),
 ('00000000-0000-4000-8000-000000000002','22222222-2222-4222-8222-222222222222','analyst','Test analyst');

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
do $$ begin
  assert (select count(*) from public.brands) = 1, 'Owner can read another brand: RLS isolation broken';
  assert (select count(*) from public.memberships) = 1, 'Owner can read another membership';
  assert (select count(*) from public.brands where code = 'KAROO') = 0, 'Filtering bypasses tenant isolation';
  perform private.require_owner('11111111-1111-4111-8111-111111111111');
  begin
    perform private.require_owner('22222222-2222-4222-8222-222222222222');
    raise exception 'Cross-brand owner privilege granted';
  exception when insufficient_privilege then null; end;
  begin
    update public.memberships set brand_id = '22222222-2222-4222-8222-222222222222';
    raise exception 'Membership reassignment allowed';
  exception when insufficient_privilege then null; end;
end $$;

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
do $$ begin
  assert (select count(*) from public.brands) = 1, 'Analyst can read another brand';
  assert (select code from public.brands) = 'KAROO', 'Analyst resolved to wrong brand';
  begin
    perform private.require_owner('22222222-2222-4222-8222-222222222222');
    raise exception 'Analyst acquired owner privilege';
  exception when insufficient_privilege then null; end;
  begin
    update public.memberships set role = 'owner';
    raise exception 'Analyst could promote themselves';
  exception when insufficient_privilege then null; end;
end $$;

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000003',true);
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000003","user_metadata":{"brand_id":"11111111-1111-4111-8111-111111111111","role":"owner"}}',true);
do $$ begin
  assert (select count(*) from public.brands) = 0, 'Unassigned user acquired brand access';
  assert (select count(*) from public.memberships) = 0, 'Unassigned user can read memberships';
  begin
    perform private.require_owner('11111111-1111-4111-8111-111111111111');
    raise exception 'User metadata granted owner access to an unassigned user';
  exception when insufficient_privilege then null; end;
end $$;

reset role;
do $$ begin
  assert not exists (
    select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
  ), 'An exposed table has no RLS';
  assert not exists (
    select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind='v' and not coalesce(c.reloptions @> array['security_invoker=true'],false)
  ), 'A public view bypasses RLS';
  assert not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.prosecdef
  ), 'Privileged function exposed in public schema';
  assert not has_table_privilege('anon','public.brands','SELECT'), 'Anonymous brand access granted';
  assert not has_table_privilege('anon','public.memberships','SELECT'), 'Anonymous membership access granted';
end $$;
rollback;
