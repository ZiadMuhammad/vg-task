-- Inspect EXECUTE itself: a nested table denial can hide a callable RPC.
begin;
do $$ declare routine record; signature text; begin
  for routine in
    select p.oid,n.nspname,p.proname from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname in ('public','private')
  loop
    signature:=routine.oid::regprocedure::text;
    assert not has_function_privilege('anon',routine.oid,'EXECUTE'),
      'Anonymous function execution granted: ' || signature;
    if routine.proname not in (
      'current_brand_id','require_owner','search_contacts','dashboard_summary',
      'prepare_campaign','confirm_campaign','retry_campaign','publish_report','revoke_report'
    ) then
      assert not has_function_privilege('authenticated',routine.oid,'EXECUTE'),
        'Server-only function execution granted: ' || signature;
    end if;
  end loop;
  assert has_function_privilege('service_role','public.read_shared_report(uuid,integer)','EXECUTE'),
    'Report server lost execution permission';
  assert has_function_privilege('service_role','public.claim_dispatch()','EXECUTE'),
    'Worker lost execution permission';
end $$;

-- New functions must also fail closed before any explicit grants are added.
create function public.permission_regression_probe() returns boolean language sql as $$ select true $$;
create function private.permission_regression_probe() returns boolean language sql as $$ select true $$;
do $$ begin
  assert not has_function_privilege('anon','public.permission_regression_probe()','EXECUTE'),
    'New public functions inherit anonymous execution';
  assert not has_function_privilege('authenticated','public.permission_regression_probe()','EXECUTE'),
    'New public functions inherit authenticated execution';
  assert not has_function_privilege('anon','private.permission_regression_probe()','EXECUTE'),
    'New private functions inherit anonymous execution';
  assert not has_function_privilege('authenticated','private.permission_regression_probe()','EXECUTE'),
    'New private functions inherit authenticated execution';
end $$;
rollback;
