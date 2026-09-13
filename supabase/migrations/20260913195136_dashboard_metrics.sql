create view public.campaign_metrics with (security_invoker = true) as
 with engagement as (
  select brand_id,campaign_id,
   count(*) as observed_events,
   count(distinct contact_id) filter (where event_type='open') as observed_unique_opens,
   count(distinct contact_id) filter (where event_type='click') as observed_unique_clicks,
   count(distinct contact_id) filter (where event_type='bounce') as observed_unique_bounces,
   count(distinct contact_id) filter (where event_type='unsubscribe') as observed_unique_unsubscribes,
   count(distinct contact_id) filter (where event_type='complaint') as observed_unique_complaints
  from public.imported_events where attributed group by brand_id,campaign_id
 ), unattributed as (
  select brand_id,campaign_id,count(*) as unattributed_events
  from public.imported_events where not attributed group by brand_id,campaign_id
 )
 select c.*,coalesce(e.observed_events,0) as observed_events,
  coalesce(e.observed_unique_opens,0) as observed_unique_opens,
  coalesce(e.observed_unique_clicks,0) as observed_unique_clicks,
  coalesce(e.observed_unique_bounces,0) as observed_unique_bounces,
  coalesce(e.observed_unique_unsubscribes,0) as observed_unique_unsubscribes,
  coalesce(e.observed_unique_complaints,0) as observed_unique_complaints,
  coalesce(u.unattributed_events,0) as unattributed_events
 from public.campaigns c left join engagement e on e.brand_id=c.brand_id and e.campaign_id=c.id
 left join unattributed u on u.brand_id=c.brand_id and u.campaign_id=c.id;
grant select on public.campaign_metrics to authenticated,service_role;

create function public.dashboard_summary() returns jsonb
language sql stable security invoker set search_path = '' as $$
 with totals as (
  select count(*) filter (where deleted_at is null) as customers,
   count(*) filter (where contactable_email or contactable_sms) as contactable,
   count(*) filter (where contactable_email) as email_contactable,
   count(*) filter (where contactable_sms) as sms_contactable,
   count(*) filter (where deleted_at is not null) as deleted,
   count(*) filter (where deleted_at is null and signup_at is null) as unknown_signup
  from public.contactability
 ), days as (
  select (now() at time zone 'UTC')::date-d as day from generate_series(0,29) d
 ), daily as (
  select (signup_at at time zone 'UTC')::date as day,count(*) as signups
  from public.contacts where deleted_at is null and signup_at >= (((now() at time zone 'UTC')::date-29)::timestamp at time zone 'UTC')
   and signup_at < (((now() at time zone 'UTC')::date+1)::timestamp at time zone 'UTC') group by 1
 ), chart as (select d.day,coalesce(c.signups,0) as signups from days d left join daily c using(day))
 select jsonb_build_object('totals',(select to_jsonb(t) from totals t),'signups',(select jsonb_agg(to_jsonb(c) order by day) from chart c),
  'campaigns',(select count(*) from public.campaigns),
  'import_problems',(select coalesce(sum(rejected_rows),0) from public.import_runs),
  'incomplete_imports',(select count(*) from public.import_runs where status<>'complete'),
  'unattributed_events',(select count(*) from public.imported_events where not attributed),
  'as_of',now())
$$;
grant execute on function public.dashboard_summary() to authenticated;

-- Cover the dashboard's unattributed-event count without reading event payload rows.
create index imported_events_unattributed_idx on public.imported_events(brand_id,campaign_id) where not attributed;
create or replace function public.search_contacts(p_query text default '',p_country text default '',p_eligibility text default 'all',p_page integer default 1) returns jsonb
language plpgsql stable security invoker set search_path = '' as $$
declare result jsonb; needle text;
begin
 if length(p_query)>100 or p_page<1 or p_page>10000 or p_eligibility not in ('all','email','sms','none') or (p_country<>'' and p_country !~ '^[A-Z]{2}$') then
  raise exception 'Invalid customer filter' using errcode='22023';
 end if;
 needle := '%' || replace(replace(replace(lower(p_query),'\','\\'),'%','\%'),'_','\_') || '%';
 with filtered as not materialized (
  select id,external_id,full_name,email,phone,country,city,signup_at,status,consent_marketing,contactable_email,contactable_sms
  from public.contactability
  where (p_query='' or lower(full_name || ' ' || coalesce(email,'') || ' ' || external_id) like needle)
   and (p_country='' or country=p_country)
   and (p_eligibility='all' or (p_eligibility='email' and contactable_email) or (p_eligibility='sms' and contactable_sms) or (p_eligibility='none' and not contactable_email and not contactable_sms))
 ), page_rows as (select * from filtered order by external_id limit 50 offset (p_page-1)*50)
 select jsonb_build_object('total',(select count(*) from filtered),'page',p_page,'rows',coalesce((select jsonb_agg(to_jsonb(p) order by external_id) from page_rows p),'[]'::jsonb)) into result;
 return result;
end $$;
grant execute on function public.search_contacts(text,text,text,integer) to authenticated;

notify pgrst,'reload schema';
