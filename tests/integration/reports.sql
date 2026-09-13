-- Every fixture, queued job, and delivery event rolls back, including on the hosted project.
begin;


delete from public.memberships;
insert into auth.users(id,email) values
 ('eeeeeeee-0000-4000-8000-000000000001','share-owner@example.test'),
 ('eeeeeeee-0000-4000-8000-000000000002','share-analyst@example.test');
insert into public.memberships(user_id,brand_id,role,display_name) values
 ('eeeeeeee-0000-4000-8000-000000000001','33333333-3333-4333-8333-333333333333','owner','Share owner'),
 ('eeeeeeee-0000-4000-8000-000000000002','33333333-3333-4333-8333-333333333333','analyst','Share analyst');
insert into public.import_runs(id,brand_id,file_name,sha256,kind,encoding,status) values
 ('eeeeeeee-dddd-4ddd-8ddd-eeeeeeeedddd','33333333-3333-4333-8333-333333333333','share-test.csv',repeat('d',64),'contacts','UTF-8','complete');
insert into public.contacts(brand_id,external_id,full_name,email,country,status,consent_marketing,source_priority,import_run_id) values
 ('33333333-3333-4333-8333-333333333333','DISPATCH-1','One','one@share.test','ZZ','active',true,1,'eeeeeeee-dddd-4ddd-8ddd-eeeeeeeedddd'),
 ('33333333-3333-4333-8333-333333333333','DISPATCH-2','Two','two@share.test','ZZ','active',true,1,'eeeeeeee-dddd-4ddd-8ddd-eeeeeeeedddd'),
 ('33333333-3333-4333-8333-333333333333','DISPATCH-3','Three','three@share.test','ZZ','active',true,1,'eeeeeeee-dddd-4ddd-8ddd-eeeeeeeedddd'),
 ('33333333-3333-4333-8333-333333333333','DISPATCH-DUP','Duplicate','one@share.test','ZZ','active',true,1,'eeeeeeee-dddd-4ddd-8ddd-eeeeeeeedddd'),
 ('33333333-3333-4333-8333-333333333333','DISPATCH-SHARED','Shared','shared@share.test','ZZ','active',true,1,'eeeeeeee-dddd-4ddd-8ddd-eeeeeeeedddd'),
 ('33333333-3333-4333-8333-333333333333','DISPATCH-OPTOUT','Opted out','shared@share.test','ZZ','unsubscribed',false,1,'eeeeeeee-dddd-4ddd-8ddd-eeeeeeeedddd');
insert into public.campaigns(id,brand_id,external_id,name,channel,target_country,reported_sent,reported_delivered,reported_bounced,reported_opens,reported_clicks,spend_minor,sent_at,import_run_id) values
 ('eeeeeeee-0000-4000-8000-000000000004','33333333-3333-4333-8333-333333333333','DISPATCH-CAMPAIGN','Share test','email','ZZ',0,0,0,0,0,0,now(),'eeeeeeee-dddd-4ddd-8ddd-eeeeeeeedddd');
set local role authenticated;
select set_config('request.jwt.claim.sub','eeeeeeee-0000-4000-8000-000000000002',true);
do $$ begin
 begin perform public.publish_report('eeeeeeee-0000-4000-8000-000000000004','correct-horse-report'); raise exception 'Analyst published report'; exception when insufficient_privilege then null; end;
 begin perform public.verify_report_password(gen_random_uuid(),'correct-horse-report',repeat('a',64)); raise exception 'Portal user bypassed web report verification'; exception when insufficient_privilege then null; end;
 begin perform 1 from private.report_credentials; raise exception 'Portal user read password hashes'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','eeeeeeee-0000-4000-8000-000000000001',true);
select public.publish_report('eeeeeeee-0000-4000-8000-000000000004','correct-horse-report');
set local role anon;
do $$ begin
 begin perform public.read_shared_report(gen_random_uuid(),1); raise exception 'Anonymous caller bypassed password'; exception when insufficient_privilege then null; end;
 begin perform public.verify_report_password(gen_random_uuid(),'correct-horse-report',repeat('a',64)); raise exception 'Anonymous caller obtained report session'; exception when insufficient_privilege then null; end;
end $$;
set local role service_role;
do $$ declare rid uuid; verified jsonb; report jsonb; i integer; begin
 select id into rid from public.shared_reports where campaign_id='eeeeeeee-0000-4000-8000-000000000004';
 assert public.verify_report_password(rid,'incorrect-password',repeat('a',64)) is null,'Wrong password accepted';
 verified:=public.verify_report_password(rid,'correct-horse-report',repeat('a',64));
 assert verified->>'report_id'=rid::text and (verified->>'version')::int=1,'Correct password did not yield the scoped version';
 report:=public.read_shared_report(rid,1);
 assert report->>'campaign_name'='Share test','Report resolved to another campaign';
 assert (select array_agg(key order by key) from jsonb_object_keys(report) key)=array['brand_name','campaign_name','channel','historical_date','live','observed','reported'],'Report leaked an unexpected field';
 assert report::text not like '%@share.test%' and report::text not like '%password%' and report::text not like '%contact_id%','Report leaked credentials or recipient data';
 assert public.read_shared_report(rid,2) is null,'Invalid session version accepted';
 for i in 1..8 loop perform public.verify_report_password(rid,'incorrect-password',repeat('b',64)); end loop;
 assert public.verify_report_password(rid,'correct-horse-report',repeat('b',64)) is null,'Attempt limit bypassed';
end $$;
set local role authenticated;
select public.publish_report('eeeeeeee-0000-4000-8000-000000000004','replacement-report-password');
set local role service_role;
do $$ declare rid uuid; begin
 select id into rid from public.shared_reports where campaign_id='eeeeeeee-0000-4000-8000-000000000004';
 assert public.read_shared_report(rid,1) is null,'Password rotation left old sessions valid';
 assert public.read_shared_report(rid,2) is not null,'New session cannot read report';
 assert public.verify_report_password(rid,'correct-horse-report',repeat('c',64)) is null,'Old password remains valid';
end $$;
set local role authenticated;
select public.revoke_report((select id from public.shared_reports where campaign_id='eeeeeeee-0000-4000-8000-000000000004'));
set local role service_role;
do $$ declare rid uuid; begin
 select id into rid from public.shared_reports where campaign_id='eeeeeeee-0000-4000-8000-000000000004';
 assert public.read_shared_report(rid,2) is null,'Revocation did not invalidate the session';
 assert public.verify_report_password(rid,'replacement-report-password',repeat('d',64)) is null,'Revoked report password accepted';
end $$;
rollback;
