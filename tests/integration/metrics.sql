begin;
insert into auth.users(id,email) values ('00000000-0000-4000-8000-000000000004','metric-test@example.test');
delete from public.memberships where brand_id='33333333-3333-4333-8333-333333333333' and role='owner';
insert into public.memberships(user_id,brand_id,role,display_name) values ('00000000-0000-4000-8000-000000000004','33333333-3333-4333-8333-333333333333','owner','Metric test');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000004',true);
create temporary table metric_baseline on commit drop as select public.dashboard_summary() as data;
reset role;
insert into public.import_runs(id,brand_id,file_name,sha256,kind,encoding,status) values ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','33333333-3333-4333-8333-333333333333','metric-test.csv',repeat('c',64),'contacts','UTF-8','complete');
insert into public.contacts(id,brand_id,external_id,full_name,email,phone,signup_at,deleted_at,status,consent_marketing,source_priority,import_run_id) values
 ('cccccccc-0000-4000-8000-000000000001','33333333-3333-4333-8333-333333333333','METRIC-1','Test one','metric-one@example.test',null,now(),null,'active',true,1,'cccccccc-cccc-4ccc-8ccc-cccccccccccc'),
 ('cccccccc-0000-4000-8000-000000000002','33333333-3333-4333-8333-333333333333','METRIC-2','Deleted test','metric-deleted@example.test',null,now(),now(),'active',true,1,'cccccccc-cccc-4ccc-8ccc-cccccccccccc'),
 ('cccccccc-0000-4000-8000-000000000003','33333333-3333-4333-8333-333333333333','METRIC-3','Unknown signup',null,'+212653959127',null,null,'active',true,1,'cccccccc-cccc-4ccc-8ccc-cccccccccccc');
insert into public.campaigns(id,brand_id,external_id,name,channel,reported_sent,reported_delivered,reported_bounced,reported_opens,reported_clicks,spend_minor,sent_at,import_run_id) values
 ('cccccccc-0000-4000-8000-000000000004','33333333-3333-4333-8333-333333333333','METRIC-CAMPAIGN','Metric campaign','email',10,9,1,12,3,29,now(),'cccccccc-cccc-4ccc-8ccc-cccccccccccc');
insert into public.imported_events(brand_id,event_id,contact_id,campaign_id,campaign_external_id,event_type,channel,occurred_at,attributed,import_run_id) values
 ('33333333-3333-4333-8333-333333333333','METRIC-OPEN-1','cccccccc-0000-4000-8000-000000000001','cccccccc-0000-4000-8000-000000000004','METRIC-CAMPAIGN','open','email',now(),true,'cccccccc-cccc-4ccc-8ccc-cccccccccccc'),
 ('33333333-3333-4333-8333-333333333333','METRIC-OPEN-2','cccccccc-0000-4000-8000-000000000001','cccccccc-0000-4000-8000-000000000004','METRIC-CAMPAIGN','open','email',now()-interval '1 hour',true,'cccccccc-cccc-4ccc-8ccc-cccccccccccc'),
 ('33333333-3333-4333-8333-333333333333','METRIC-CLICK','cccccccc-0000-4000-8000-000000000001','cccccccc-0000-4000-8000-000000000004','METRIC-CAMPAIGN','click','email',now(),true,'cccccccc-cccc-4ccc-8ccc-cccccccccccc');

set local role authenticated;
do $$ declare current_data jsonb; previous_data jsonb; begin
 select public.dashboard_summary() into current_data;
 select data into previous_data from metric_baseline;
 assert (current_data->'totals'->>'customers')::int=(previous_data->'totals'->>'customers')::int+2, 'Deleted customer inflated total';
 assert (current_data->'totals'->>'contactable')::int=(previous_data->'totals'->>'contactable')::int+2, 'Contactability count wrong';
 assert (current_data->'totals'->>'unknown_signup')::int=(previous_data->'totals'->>'unknown_signup')::int+1, 'Unknown signup counted as a known date';
 assert jsonb_array_length(current_data->'signups')=30, 'Signup series must contain all 30 UTC days';
 assert (select sum((value->>'signups')::int) from jsonb_array_elements(current_data->'signups'))=(select sum((value->>'signups')::int) from jsonb_array_elements(previous_data->'signups'))+1, 'Daily signup counted a deleted/unknown customer';
 assert (select observed_events from public.campaign_metrics where external_id='METRIC-CAMPAIGN')=3, 'Wrong observed event count';
 assert (select observed_unique_opens from public.campaign_metrics where external_id='METRIC-CAMPAIGN')=1, 'Repeated opens counted as different people';
 assert (select observed_unique_clicks from public.campaign_metrics where external_id='METRIC-CAMPAIGN')=1, 'Click count wrong';
 assert (select reported_opens from public.campaign_metrics where external_id='METRIC-CAMPAIGN')=12, 'Reported opens were silently clamped or replaced';
 assert (select spend_minor from public.campaign_metrics where external_id='METRIC-CAMPAIGN')=29, 'Source spend lost precision';
end $$;
rollback;
