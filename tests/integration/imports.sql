begin;
insert into public.import_runs(id,brand_id,file_name,sha256,kind,encoding) values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','test.csv',repeat('a',64),'contacts','UTF-8'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','22222222-2222-4222-8222-222222222222','test.csv',repeat('b',64),'contacts','UTF-8');
set local role service_role;
select public.ingest_contacts('11111111-1111-4111-8111-111111111111','[{"external_id":"TEST-IMPORT","full_name":"Test customer","email":"test@example.test","phone":null,"country":"KE","status":"active","consent_marketing":true,"source_priority":1,"import_run_id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"}]');
select public.ingest_contacts('11111111-1111-4111-8111-111111111111','[{"external_id":"TEST-IMPORT","full_name":"Updated customer","email":"test@example.test","phone":null,"country":"KE","status":"active","consent_marketing":false,"source_priority":2,"import_run_id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"}]');
select public.ingest_contacts('11111111-1111-4111-8111-111111111111','[{"external_id":"TEST-IMPORT","full_name":"Test customer","email":"test@example.test","phone":null,"country":"KE","status":"active","consent_marketing":true,"source_priority":1,"import_run_id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"}]');
do $$ begin
 assert (select count(*) from public.contacts where external_id='TEST-IMPORT')=1, 'Replay duplicated a customer';
 assert (select full_name from public.contacts where external_id='TEST-IMPORT')='Updated customer', 'Baseline replay overwrote delta';
 assert not (select consent_marketing from public.contacts where external_id='TEST-IMPORT'), 'Baseline restored revoked consent';
 begin
  insert into public.contacts(brand_id,external_id,full_name,status,consent_marketing,source_priority,import_run_id) values ('11111111-1111-4111-8111-111111111111','TEST-CROSS','Cross brand','active',true,1,'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
  raise exception 'Cross-brand import reference accepted';
 exception when foreign_key_violation then null; end;
end $$;
insert into public.imported_events(brand_id,event_id,contact_id,campaign_external_id,event_type,channel,occurred_at,attributed,import_run_id)
 select brand_id,'TEST-ORPHAN-UNSUBSCRIBE',id,'MISSING-CAMPAIGN','unsubscribe','email',now(),false,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' from public.contacts where external_id='TEST-IMPORT';
do $$ declare page jsonb; cursor_id uuid; begin
 loop
  page := public.reconcile_import_page('11111111-1111-4111-8111-111111111111',cursor_id);
  exit when (page->>'processed')::integer=0;
  cursor_id := (page->>'cursor')::uuid;
 end loop;
end $$;
select public.ingest_contacts('11111111-1111-4111-8111-111111111111','[{"external_id":"TEST-IMPORT","full_name":"Updated customer","email":"test@example.test","phone":null,"country":"KE","status":"active","consent_marketing":true,"source_priority":2,"import_run_id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"}]');
do $$ begin
 assert (select global_opt_out from public.contacts where external_id='TEST-IMPORT'), 'Import erased an event opt-out';
 assert not (select contactable_email from public.contactability where external_id='TEST-IMPORT'), 'Orphan unsubscribe left customer contactable';
 assert not (select contactable_sms from public.contactability where external_id='TEST-IMPORT'), 'Opt-out did not block both channels';
end $$;
set local role authenticated;
do $$ begin
 begin
  perform public.ingest_contacts('11111111-1111-4111-8111-111111111111','[]');
  raise exception 'Authenticated client could call importer';
 exception when insufficient_privilege then null; end;
end $$;
rollback;
