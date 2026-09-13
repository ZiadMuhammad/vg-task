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

create table public.import_runs (
 id uuid primary key default gen_random_uuid(),
 brand_id uuid not null references public.brands(id),
 file_name text not null,
 sha256 text not null check (sha256 ~ '^[a-f0-9]{64}$'),
 kind text not null check (kind in ('contacts','campaigns','events','send_log')),
 status text not null default 'running' check (status in ('running','complete','failed')),
 encoding text not null,
 total_rows integer not null default 0 check (total_rows >= 0),
 accepted_rows integer not null default 0 check (accepted_rows >= 0),
 rejected_rows integer not null default 0 check (rejected_rows >= 0),
 warning_rows integer not null default 0 check (warning_rows >= 0),
 duplicate_rows integer not null default 0 check (duplicate_rows >= 0),
 error text,
 started_at timestamptz not null default now(),
 finished_at timestamptz,
 unique (brand_id,file_name,sha256), unique (brand_id,id)
);
create index import_runs_brand_started_idx on public.import_runs(brand_id,started_at desc);
create table public.import_issues (
 id bigint generated always as identity primary key,
 brand_id uuid not null,
 import_run_id uuid not null,
 row_number integer not null check (row_number > 0),
 severity text not null check (severity in ('warning','error')),
 code text not null,
 message text not null,
 external_id text,
 raw jsonb not null,
 foreign key (brand_id,import_run_id) references public.import_runs(brand_id,id),
 unique (import_run_id,row_number,code)
);
create index import_issues_brand_run_idx on public.import_issues(brand_id,import_run_id,row_number);
create table public.contacts (
 id uuid primary key default gen_random_uuid(),
 brand_id uuid not null references public.brands(id),
 external_id text not null check (length(external_id) between 1 and 100),
 full_name text not null check (length(full_name) between 1 and 200),
 email text check (email is null or email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
 phone text check (phone is null or phone ~ '^\+[1-9][0-9]{7,14}$'),
 country text check (country is null or country ~ '^[A-Z]{2}$'),
 city text,
 signup_at timestamptz,
 status text not null check (status in ('active','pending','unsubscribed','bounced')),
 consent_marketing boolean not null,
 deleted_at timestamptz,
 suppressed_until timestamptz,
 global_opt_out boolean not null default false,
 email_bounced boolean not null default false,
 sms_bounced boolean not null default false,
 source_priority integer not null,
 import_run_id uuid not null,
 updated_at timestamptz not null default now(),
 unique (brand_id,external_id), unique (brand_id,id),
 foreign key (brand_id,import_run_id) references public.import_runs(brand_id,id)
);
create index contacts_brand_signup_idx on public.contacts(brand_id,signup_at,id);
create index contacts_brand_country_idx on public.contacts(brand_id,country,id);
create index contacts_brand_email_idx on public.contacts(brand_id,email) where email is not null;
create index contacts_brand_phone_idx on public.contacts(brand_id,phone) where phone is not null;
create index contacts_import_run_idx on public.contacts(brand_id,import_run_id);
create extension if not exists pg_trgm with schema extensions;
create index contacts_search_idx on public.contacts using gin ((lower(full_name || ' ' || coalesce(email,'') || ' ' || external_id)) extensions.gin_trgm_ops);

create table public.campaigns (
 id uuid primary key default gen_random_uuid(),
 brand_id uuid not null references public.brands(id),
 external_id text not null,
 name text not null check (length(name) between 1 and 200),
 channel text not null check (channel in ('email','sms')),
 target_country text check (target_country is null or target_country ~ '^[A-Z]{2}$'),
 reported_sent integer not null check (reported_sent >= 0),
 reported_delivered integer not null check (reported_delivered >= 0),
 reported_bounced integer not null check (reported_bounced >= 0),
 reported_opens integer not null check (reported_opens >= 0),
 reported_clicks integer not null check (reported_clicks >= 0),
 spend_minor bigint not null check (spend_minor >= 0),
 sent_at timestamptz not null,
 source_local_time text,
 parent_external_id text,
 import_run_id uuid not null,
 unique (brand_id,external_id), unique (brand_id,id),
 foreign key (brand_id,import_run_id) references public.import_runs(brand_id,id)
);
create index campaigns_brand_sent_idx on public.campaigns(brand_id,sent_at desc,id);
create index campaigns_import_run_idx on public.campaigns(brand_id,import_run_id);

create table public.imported_events (
 id bigint generated always as identity primary key,
 brand_id uuid not null,
 event_id text not null,
 contact_id uuid not null,
 campaign_id uuid,
 campaign_external_id text not null,
 event_type text not null check (event_type in ('open','click','bounce','unsubscribe','complaint')),
 channel text not null check (channel in ('email','sms')),
 occurred_at timestamptz not null,
 attributed boolean not null,
 import_run_id uuid not null,
 foreign key (brand_id,contact_id) references public.contacts(brand_id,id),
 foreign key (brand_id,campaign_id) references public.campaigns(brand_id,id),
 foreign key (brand_id,import_run_id) references public.import_runs(brand_id,id),
 unique (brand_id,event_id),
 check (not attributed or campaign_id is not null)
);
create index imported_events_campaign_idx on public.imported_events(brand_id,campaign_id,event_type,contact_id) where attributed;
create index imported_events_contact_idx on public.imported_events(brand_id,contact_id,event_type,channel);
create index imported_events_import_run_idx on public.imported_events(brand_id,import_run_id);

create table public.historical_sends (
 id uuid primary key default gen_random_uuid(),
 brand_id uuid not null,
 batch_key text not null,
 campaign_id uuid not null,
 queued_at timestamptz not null,
 recipient_count integer not null check (recipient_count >= 0),
 status text not null check (status in ('sent','queued','failed','sending')),
 import_run_id uuid not null,
 unique (brand_id,batch_key),
 foreign key (brand_id,campaign_id) references public.campaigns(brand_id,id),
 foreign key (brand_id,import_run_id) references public.import_runs(brand_id,id)
);
create index historical_sends_campaign_idx on public.historical_sends(brand_id,campaign_id);
create index historical_sends_import_run_idx on public.historical_sends(brand_id,import_run_id);

do $$ declare t text; begin
 foreach t in array array['import_runs','import_issues','contacts','campaigns','imported_events','historical_sends'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('create policy tenant_read on public.%I for select to authenticated using (brand_id = (select private.current_brand_id()))',t);
  execute format('grant select on public.%I to authenticated',t);
  execute format('grant all on public.%I to service_role',t);
 end loop;
end $$;
grant usage on sequence public.import_issues_id_seq,public.imported_events_id_seq to service_role;

create view public.contactability with (security_invoker = true) as
 select c.*,
 (status = 'active' and consent_marketing and deleted_at is null and not global_opt_out and (suppressed_until is null or suppressed_until <= now()) and email is not null and not email_bounced) as contactable_email,
 (status = 'active' and consent_marketing and deleted_at is null and not global_opt_out and (suppressed_until is null or suppressed_until <= now()) and phone is not null and not sms_bounced) as contactable_sms
 from public.contacts c;
grant select on public.contactability to authenticated,service_role;

-- The importer alone may mutate imported records; application users remain read-only.
create function public.ingest_contacts(p_brand_id uuid,p_rows jsonb) returns integer
language plpgsql security invoker set search_path = '' as $$
declare affected integer;
begin
 insert into public.contacts(brand_id,external_id,full_name,email,phone,country,city,signup_at,status,consent_marketing,deleted_at,suppressed_until,source_priority,import_run_id)
 select p_brand_id,r.external_id,r.full_name,r.email,r.phone,r.country,r.city,r.signup_at,r.status,r.consent_marketing,r.deleted_at,r.suppressed_until,r.source_priority,r.import_run_id
 from jsonb_to_recordset(p_rows) r(external_id text,full_name text,email text,phone text,country text,city text,signup_at timestamptz,status text,consent_marketing boolean,deleted_at timestamptz,suppressed_until timestamptz,source_priority integer,import_run_id uuid)
 on conflict (brand_id,external_id) do update set
  full_name=excluded.full_name,email=excluded.email,phone=excluded.phone,country=excluded.country,city=excluded.city,signup_at=excluded.signup_at,status=excluded.status,consent_marketing=excluded.consent_marketing,deleted_at=excluded.deleted_at,suppressed_until=excluded.suppressed_until,source_priority=excluded.source_priority,import_run_id=excluded.import_run_id,updated_at=now()
 where public.contacts.source_priority <= excluded.source_priority;
 get diagnostics affected = row_count;
 return affected;
end $$;
grant execute on function public.ingest_contacts(uuid,jsonb) to service_role;

create function public.reconcile_import_page(p_brand_id uuid,p_after uuid default null) returns jsonb
language sql volatile security invoker set search_path = '' as $$
 with page as materialized (
  select id from public.contacts where brand_id=p_brand_id and id>coalesce(p_after,'00000000-0000-0000-0000-000000000000'::uuid) order by id limit 500
 ), adverse as materialized (
  select p.id,a.* from page p cross join lateral (
   select coalesce(bool_or(event_type in ('complaint','unsubscribe')),false) as opt_out,
    coalesce(bool_or(event_type='bounce' and channel='email'),false) as email_bounced,
    coalesce(bool_or(event_type='bounce' and channel='sms'),false) as sms_bounced
   from public.imported_events where brand_id=p_brand_id and contact_id=p.id and event_type in ('complaint','unsubscribe','bounce')
  ) a
 ), updated as (
  update public.contacts c set global_opt_out=c.global_opt_out or a.opt_out,email_bounced=c.email_bounced or a.email_bounced,sms_bounced=c.sms_bounced or a.sms_bounced
  from adverse a where c.brand_id=p_brand_id and c.id=a.id
   and ((a.opt_out and not c.global_opt_out) or (a.email_bounced and not c.email_bounced) or (a.sms_bounced and not c.sms_bounced)) returning c.id
 )
 select jsonb_build_object('cursor',(select id from page order by id desc limit 1),'processed',(select count(*) from page),'updated',(select count(*) from updated))
$$;
grant execute on function public.reconcile_import_page(uuid,uuid) to service_role;
create function public.search_contacts(p_query text default '',p_country text default '',p_eligibility text default 'all',p_page integer default 1) returns jsonb
language plpgsql stable security invoker set search_path = '' as $$
declare result jsonb; needle text;
begin
 if length(p_query)>100 or p_page<1 or p_page>10000 or p_eligibility not in ('all','email','sms','none') or (p_country<>'' and p_country !~ '^[A-Z]{2}$') then
  raise exception 'Invalid customer filter' using errcode='22023';
 end if;
 needle := '%' || replace(replace(replace(lower(p_query),'\','\\'),'%','\%'),'_','\_') || '%';
 with filtered as materialized (
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

-- M5: approval is a durable fact; transport and delivery are separate observations.
create extension if not exists pgmq;
select pgmq.create('campaign_dispatch');
revoke all on schema pgmq from public,anon,authenticated;
grant usage on schema pgmq to service_role;
grant all on all tables in schema pgmq to service_role;
grant usage on all sequences in schema pgmq to service_role;
grant execute on all functions in schema pgmq to service_role;
alter table pgmq.q_campaign_dispatch enable row level security;
alter table pgmq.a_campaign_dispatch enable row level security;

create table public.campaign_approvals (
 id uuid primary key default gen_random_uuid(),
 brand_id uuid not null,
 campaign_id uuid not null,
 campaign_name text not null,
 channel text not null check(channel in ('email','sms')),
 target_country text,
 prepared_at timestamptz not null default now(),
 expires_at timestamptz not null default now()+interval '15 minutes',
 recipient_count integer not null default 0 check(recipient_count>=0),
 audience_hash text not null default '',
 approved_at timestamptz,
 approved_by uuid references auth.users(id),
 unique(brand_id,id),
 foreign key(brand_id,campaign_id) references public.campaigns(brand_id,id),
 check((approved_at is null) = (approved_by is null))
);
create unique index one_approved_dispatch on public.campaign_approvals(brand_id,campaign_id) where approved_at is not null;
create index approvals_campaign_idx on public.campaign_approvals(brand_id,campaign_id,prepared_at desc);
create table public.approved_recipients (
 id uuid primary key default gen_random_uuid(),
 brand_id uuid not null,
 approval_id uuid not null,
 contact_id uuid not null,
 position integer not null,
 batch_number integer not null,
 external_id text not null,
 full_name text not null,
 destination text not null,
 submission_status text not null default 'queued' check(submission_status in ('queued','accepted','rejected','withheld')),
 submission_reason text,
 delivered boolean not null default false,
 bounced boolean not null default false,
 opened boolean not null default false,
 unsubscribed boolean not null default false,
 unique(brand_id,id), unique(approval_id,position), unique(approval_id,destination),
 foreign key(brand_id,approval_id) references public.campaign_approvals(brand_id,id) on delete cascade,
 foreign key(brand_id,contact_id) references public.contacts(brand_id,id)
);
create index recipients_batch_idx on public.approved_recipients(brand_id,approval_id,batch_number);
create index recipients_contact_idx on public.approved_recipients(brand_id,contact_id);
create table public.provider_batches (
 id uuid primary key default gen_random_uuid(),
 brand_id uuid not null,
 approval_id uuid not null,
 batch_number integer not null,
 status text not null default 'queued' check(status in ('queued','sending','retry','accepted','withheld','attention')),
 attempts integer not null default 0,
 provider_batch_id text unique,
 last_error text,
 last_synced_at timestamptz,
 next_attempt_at timestamptz not null default now(),
 created_at timestamptz not null default now(),
 unique(brand_id,id), unique(approval_id,batch_number),
 foreign key(brand_id,approval_id) references public.campaign_approvals(brand_id,id)
);
create index batches_approval_idx on public.provider_batches(brand_id,approval_id);
create table private.batch_work (
 batch_id uuid primary key references public.provider_batches(id),
 payload jsonb,
 idempotency_key text not null unique default gen_random_uuid()::text,
 queue_id bigint not null,
 lease_token uuid,
 lease_until timestamptz,
 retry_allowance integer not null default 8,
 cursor text,
 scan_started_at timestamptz not null default now(),
 poll_after timestamptz not null default now(),
 poll_token uuid,
 poll_until timestamptz
);
alter table private.batch_work enable row level security;
grant all on private.batch_work to service_role;
create table public.provider_events (
 brand_id uuid not null,
 batch_id uuid not null,
 event_id text not null,
 recipient_id uuid not null,
 event_type text not null check(event_type in ('delivered','bounced','opened','unsubscribed')),
 occurred_at timestamptz,
 received_at timestamptz not null default now(),
 primary key(batch_id,event_id),
 foreign key(brand_id,batch_id) references public.provider_batches(brand_id,id),
 foreign key(brand_id,recipient_id) references public.approved_recipients(brand_id,id)
);
create index provider_events_brand_batch_idx on public.provider_events(brand_id,batch_id);
create index provider_events_recipient_idx on public.provider_events(brand_id,recipient_id);
create table public.provider_event_issues (
 id bigint generated always as identity primary key,
 brand_id uuid not null,
 batch_id uuid not null,
 fingerprint text not null,
 reason text not null,
 first_seen_at timestamptz not null default now(),
 unique(batch_id,fingerprint),
 foreign key(brand_id,batch_id) references public.provider_batches(brand_id,id)
);
create index event_issues_brand_batch_idx on public.provider_event_issues(brand_id,batch_id);
grant usage on sequence public.provider_event_issues_id_seq to service_role;
do $$ declare t text; begin
 foreach t in array array['campaign_approvals','approved_recipients','provider_batches','provider_events','provider_event_issues'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('create policy tenant_read on public.%I for select to authenticated using (brand_id = (select private.current_brand_id()))',t);
  execute format('grant select on public.%I to authenticated',t);
  execute format('grant all on public.%I to service_role',t);
 end loop;
end $$;

create function private.protect_approval() returns trigger language plpgsql set search_path='' as $$
begin
 if old.approved_at is not null then raise exception 'Approved history is immutable'; end if;
 if tg_op='DELETE' then return old; end if;
 if new.approved_at is not null then
  perform private.require_owner(new.brand_id);
  if new.approved_by is distinct from auth.uid() then raise exception 'Approval identity mismatch'; end if;
 end if;
 return new;
end $$;
create trigger protect_approval before insert or update or delete on public.campaign_approvals for each row execute function private.protect_approval();
create function private.protect_recipient() returns trigger language plpgsql set search_path='' as $$
declare a uuid; b uuid; frozen boolean; begin
 a:=case when tg_op='DELETE' then old.approval_id else new.approval_id end;
 b:=case when tg_op='DELETE' then old.brand_id else new.brand_id end;
 select approved_at is not null into frozen from public.campaign_approvals where id=a and brand_id=b;
 if tg_op='UPDATE' and (old.approval_id,old.brand_id) is distinct from (new.approval_id,new.brand_id) then raise exception 'Recipient identity is immutable'; end if;
 if frozen and (tg_op<>'UPDATE' or
  (to_jsonb(new)-array['submission_status','submission_reason','delivered','bounced','opened','unsubscribed']) is distinct from
  (to_jsonb(old)-array['submission_status','submission_reason','delivered','bounced','opened','unsubscribed']))
 then raise exception 'Approved audience is immutable'; end if;
 if tg_op='DELETE' then return old; end if;
 return new;
end $$;
create trigger protect_recipient before update on public.approved_recipients for each row execute function private.protect_recipient();
-- Statement guards avoid one parent lookup per row when freezing a large audience.
create function private.protect_recipient_insert() returns trigger language plpgsql set search_path='' as $$ begin
 if exists(select 1 from inserted_recipients r join public.campaign_approvals a on a.id=r.approval_id where a.approved_at is not null) then
  raise exception 'Approved audience is immutable';
 end if; return null;
end $$;
create trigger protect_recipient_insert after insert on public.approved_recipients referencing new table as inserted_recipients for each statement execute function private.protect_recipient_insert();
create function private.protect_recipient_delete() returns trigger language plpgsql set search_path='' as $$ begin
 if exists(select 1 from deleted_recipients r join public.campaign_approvals a on a.id=r.approval_id where a.approved_at is not null) then
  raise exception 'Approved audience is immutable';
 end if; return null;
end $$;
create trigger protect_recipient_delete after delete on public.approved_recipients referencing old table as deleted_recipients for each statement execute function private.protect_recipient_delete();
create function private.protect_payload() returns trigger language plpgsql set search_path='' as $$ begin
 if tg_op='DELETE' then raise exception 'Durable request cannot be deleted'; end if;
 if old.batch_id<>new.batch_id or old.idempotency_key<>new.idempotency_key or (old.payload is not null and old.payload is distinct from new.payload) then
  raise exception 'Attempted request is immutable';
 end if; return new;
end $$;
create trigger protect_payload before update or delete on private.batch_work for each row execute function private.protect_payload();

-- A shared address with a non-contactable record is excluded conservatively.
create function private.destination_eligible(p_brand uuid,p_channel text,p_destination text) returns boolean
language sql stable set search_path='' as $$
 select coalesce(bool_and(case when p_channel='email' then c.contactable_email else c.contactable_sms end),false)
 from public.contactability c where c.brand_id=p_brand and
 ((p_channel='email' and c.email=p_destination) or (p_channel='sms' and c.phone=p_destination))
$$;
grant execute on function private.destination_eligible(uuid,text,text) to service_role;
create function private.prepare_campaign(p_campaign_id uuid,p_refresh boolean) returns uuid
language plpgsql security definer set search_path='' set work_mem='16MB' as $$
declare c public.campaigns; a public.campaign_approvals; result uuid; begin
 select * into c from public.campaigns where id=p_campaign_id for update;
 perform private.require_owner(c.brand_id);
 select * into a from public.campaign_approvals where campaign_id=c.id and brand_id=c.brand_id order by approved_at desc nulls last,prepared_at desc limit 1;
 if a.approved_at is not null or (not p_refresh and a.expires_at>now()) then return a.id; end if;
 -- Discard only unapproved previews under the campaign lock, bounding snapshot storage.
 delete from public.campaign_approvals where campaign_id=c.id and approved_at is null;
 insert into public.campaign_approvals(brand_id,campaign_id,campaign_name,channel,target_country)
 values(c.brand_id,c.id,c.name,c.channel,c.target_country) returning id into result;
 -- Aggregate destination eligibility once, even for the 82k-customer brand.
 with candidates as materialized (
  select v.id,v.external_id,v.full_name,v.country,case when c.channel='email' then email else phone end destination,
   case when c.channel='email' then contactable_email else contactable_sms end eligible
  from public.contactability v where v.brand_id=c.brand_id
 ), safe_destinations as (
  select destination from candidates where destination is not null group by destination having bool_and(eligible)
 ), audience as (
  select distinct on(v.destination) v.id,v.external_id,v.full_name,v.destination
  from candidates v join safe_destinations s using(destination)
  where v.eligible and (c.target_country is null or v.country=c.target_country)
  order by v.destination,v.id
 )
 insert into public.approved_recipients(brand_id,approval_id,contact_id,position,batch_number,external_id,full_name,destination)
 select c.brand_id,result,x.id,row_number() over(order by destination)::integer,
 ((row_number() over(order by destination)-1)/100)::integer+1,x.external_id,x.full_name,x.destination from audience x;
 update public.campaign_approvals set recipient_count=s.n,audience_hash=s.hash
 from (select count(*)::integer n,md5(coalesce(string_agg(id::text||':'||destination,',' order by position),'')) hash
  from public.approved_recipients where approval_id=result) s where id=result;
 return result;
end $$;
create function public.prepare_campaign(p_campaign_id uuid,p_refresh boolean default false) returns uuid
language sql set search_path='' set statement_timeout='30s' as $$ select private.prepare_campaign(p_campaign_id,p_refresh) $$;
grant execute on function private.prepare_campaign(uuid,boolean),public.prepare_campaign(uuid,boolean) to authenticated;

create function private.confirm_campaign(p_approval_id uuid,p_count integer,p_hash text) returns uuid
language plpgsql security definer set search_path='' as $$
declare a public.campaign_approvals; c public.campaigns; b record; bid uuid; qid bigint; existing uuid; begin
 select * into a from public.campaign_approvals where id=p_approval_id;
 perform private.require_owner(a.brand_id);
 select * into c from public.campaigns where id=a.campaign_id for update;
 select * into a from public.campaign_approvals where id=p_approval_id for update;
 if not found then raise exception 'Preview was replaced. Review a new audience.'; end if;
 select id into existing from public.campaign_approvals where campaign_id=c.id and approved_at is not null;
 if existing is not null then return existing; end if;
 if a.expires_at<=now() then raise exception 'Preview expired. Refresh the audience before approving.'; end if;
 if p_count is distinct from a.recipient_count or p_hash is distinct from a.audience_hash or a.recipient_count=0 then
  raise exception 'Approval count does not match the saved audience';
 end if;
 if (a.campaign_name,a.channel,a.target_country) is distinct from (c.name,c.channel,c.target_country) or exists(
  select 1 from public.approved_recipients r left join public.contactability v on v.id=r.contact_id and v.brand_id=r.brand_id
  where r.approval_id=a.id and (v.id is null or
   (case when a.channel='email' then v.email else v.phone end) is distinct from r.destination or
   not(case when a.channel='email' then v.contactable_email else v.contactable_sms end) or
   (a.target_country is not null and v.country is distinct from a.target_country) or
   r.destination in (
    select case when a.channel='email' then cv.email else cv.phone end from public.contactability cv where cv.brand_id=a.brand_id
    group by case when a.channel='email' then cv.email else cv.phone end
    having not bool_and(case when a.channel='email' then cv.contactable_email else cv.contactable_sms end)
   ))
 ) then raise exception 'Contactability changed. Refresh and review the audience again.'; end if;
 update public.campaign_approvals set approved_at=now(),approved_by=auth.uid() where id=a.id;
 for b in select distinct batch_number from public.approved_recipients where approval_id=a.id order by batch_number loop
  insert into public.provider_batches(brand_id,approval_id,batch_number) values(a.brand_id,a.id,b.batch_number) returning id into bid;
  select pgmq.send('campaign_dispatch',jsonb_build_object('batch_id',bid)) into qid;
  insert into private.batch_work(batch_id,queue_id) values(bid,qid);
 end loop;
 return a.id;
end $$;
create function public.confirm_campaign(p_approval_id uuid,p_count integer,p_hash text) returns uuid
language sql set search_path='' set statement_timeout='30s' as $$ select private.confirm_campaign(p_approval_id,p_count,p_hash) $$;
grant execute on function private.confirm_campaign(uuid,integer,text),public.confirm_campaign(uuid,integer,text) to authenticated;

-- The worker claims one queue message. Payload and retry key commit before the HTTP call.
create function public.claim_dispatch() returns jsonb language plpgsql set search_path='' as $$
declare q record; b public.provider_batches; a public.campaign_approvals; w private.batch_work; token uuid:=gen_random_uuid(); body jsonb; begin
 select * into q from pgmq.read('campaign_dispatch',90,1);
 if not found then return null; end if;
 select * into b from public.provider_batches where id=(q.message->>'batch_id')::uuid for update;
 select * into w from private.batch_work where batch_id=b.id for update;
 if b.status in ('accepted','withheld','attention') then perform pgmq.archive('campaign_dispatch',q.msg_id); return null; end if;
 if b.next_attempt_at>now() or w.lease_until>now() then return null; end if;
 select * into a from public.campaign_approvals where id=b.approval_id;
 if w.payload is not null and exists (
  select 1 from public.approved_recipients r where r.approval_id=a.id and r.batch_number=b.batch_number and r.submission_status='queued'
   and (not private.destination_eligible(a.brand_id,a.channel,r.destination) or not exists(
    select 1 from public.contactability c where c.id=r.contact_id and c.brand_id=r.brand_id
     and (case when a.channel='email' then c.email else c.phone end)=r.destination
     and (case when a.channel='email' then c.contactable_email else c.contactable_sms end)
     and (a.target_country is null or c.country=a.target_country)))
 ) then
  update public.provider_batches set status='attention',last_error='Consent changed after an uncertain request. Retry paused; provider reconciliation is required.' where id=b.id;
  perform pgmq.archive('campaign_dispatch',q.msg_id); return null;
 end if;
 if w.payload is null then
  update public.approved_recipients r set submission_status='withheld',submission_reason='No longer contactable before dispatch'
   where r.approval_id=a.id and r.batch_number=b.batch_number and
    (not private.destination_eligible(a.brand_id,a.channel,r.destination) or not exists(
      select 1 from public.contactability c where c.id=r.contact_id and c.brand_id=r.brand_id
       and (case when a.channel='email' then c.email else c.phone end)=r.destination
       and (a.target_country is null or c.country=a.target_country)));
  select jsonb_build_object('campaign',a.campaign_name,'brand',(select code from public.brands where id=a.brand_id),
   'recipients',coalesce(jsonb_agg(jsonb_build_object('id',r.id::text,'external_id',r.external_id,'channel',a.channel,
    'email',case when a.channel='email' then r.destination end,'phone',case when a.channel='sms' then r.destination end) order by r.position),'[]'::jsonb))
  into body from public.approved_recipients r where r.approval_id=a.id and r.batch_number=b.batch_number and r.submission_status='queued';
  update private.batch_work set payload=body where batch_id=b.id;
 else body:=w.payload; end if;
 if jsonb_array_length(body->'recipients')=0 then
  update public.provider_batches set status='withheld' where id=b.id;
  perform pgmq.archive('campaign_dispatch',q.msg_id); return null;
 end if;
 update private.batch_work set lease_token=token,lease_until=now()+interval '90 seconds' where batch_id=b.id;
 update public.provider_batches set status='sending',attempts=attempts+1 where id=b.id;
 return jsonb_build_object('batch_id',b.id,'token',token,'payload',body,'idempotency_key',w.idempotency_key,'attempt',b.attempts+1);
end $$;
grant execute on function public.claim_dispatch() to service_role;

create function public.finish_dispatch(p_batch_id uuid,p_token uuid,p_provider_id text,p_results jsonb) returns boolean
language plpgsql set search_path='' as $$
declare b public.provider_batches; w private.batch_work; begin
 select * into b from public.provider_batches where id=p_batch_id for update;
 select * into w from private.batch_work where batch_id=b.id for update;
 if w.lease_token is distinct from p_token or b.status<>'sending' then return false; end if;
 if p_provider_id is null or length(p_provider_id) not between 1 and 200 or
 jsonb_array_length(p_results)<>jsonb_array_length(w.payload->'recipients') or
 exists(select 1 from jsonb_array_elements(p_results) x where x->>'status' not in ('accepted','rejected') or x->>'status' is null) or
 (select count(distinct x->>'id') from jsonb_array_elements(p_results) x)<>jsonb_array_length(p_results) or
 exists(select 1 from jsonb_array_elements(w.payload->'recipients') x where not exists(select 1 from jsonb_array_elements(p_results) y where y->>'id'=x->>'id'))
 then raise exception 'Provider response does not account for every requested recipient'; end if;
 update public.approved_recipients r set submission_status=x.status,submission_reason=left(x.reason,300)
 from jsonb_to_recordset(p_results) x(id uuid,status text,reason text)
 where r.id=x.id and r.brand_id=b.brand_id and r.approval_id=b.approval_id and r.batch_number=b.batch_number;
 update public.provider_batches set status='accepted',provider_batch_id=p_provider_id,last_error=null where id=b.id;
 update private.batch_work set lease_until=null,lease_token=null,poll_after=now() where batch_id=b.id;
 perform pgmq.archive('campaign_dispatch',w.queue_id);
 return true;
end $$;
grant execute on function public.finish_dispatch(uuid,uuid,text,jsonb) to service_role;

create function public.fail_dispatch(p_batch_id uuid,p_token uuid,p_reason text,p_delay integer,p_attention boolean default false) returns boolean
language plpgsql set search_path='' as $$
declare b public.provider_batches; w private.batch_work; pause boolean; begin
 select * into b from public.provider_batches where id=p_batch_id for update;
 select * into w from private.batch_work where batch_id=b.id for update;
 if w.lease_token is distinct from p_token or b.status<>'sending' then return false; end if;
 pause:=p_attention or b.attempts>=w.retry_allowance;
 update public.provider_batches set status=case when pause then 'attention' else 'retry' end,last_error=left(p_reason,500),
 next_attempt_at=now()+make_interval(secs=>greatest(10,least(86400,p_delay))) where id=b.id;
 update private.batch_work set lease_until=null,lease_token=null where batch_id=b.id;
 if pause then perform pgmq.archive('campaign_dispatch',w.queue_id);
 else perform pgmq.set_vt('campaign_dispatch',w.queue_id,greatest(10,least(86400,p_delay))); end if;
 return true;
end $$;
grant execute on function public.fail_dispatch(uuid,uuid,text,integer,boolean) to service_role;

create function private.retry_campaign(p_approval_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare a public.campaign_approvals; b record; qid bigint; begin
 select * into a from public.campaign_approvals where id=p_approval_id;
 perform private.require_owner(a.brand_id);
 for b in select * from public.provider_batches where approval_id=a.id and status='attention' for update loop
  select pgmq.send('campaign_dispatch',jsonb_build_object('batch_id',b.id)) into qid;
  update private.batch_work set queue_id=qid,retry_allowance=b.attempts+8,lease_until=null,lease_token=null where batch_id=b.id;
  update public.provider_batches set status='retry',next_attempt_at=now() where id=b.id;
 end loop;
end $$;
create function public.retry_campaign(p_approval_id uuid) returns void language sql set search_path='' as $$ select private.retry_campaign(p_approval_id) $$;
grant execute on function public.retry_campaign(uuid),private.retry_campaign(uuid) to authenticated;

create function public.claim_event_poll() returns jsonb language plpgsql set search_path='' as $$
declare w private.batch_work; b public.provider_batches; token uuid:=gen_random_uuid(); begin
 select x.* into w from private.batch_work x join public.provider_batches pb on pb.id=x.batch_id
 where pb.provider_batch_id is not null and x.poll_after<=now() and (x.poll_until is null or x.poll_until<now())
 order by x.poll_after,x.batch_id limit 1 for update of x skip locked;
 if not found then return null; end if;
 select * into b from public.provider_batches where id=w.batch_id;
 if w.scan_started_at<=now()-interval '5 minutes' then
  w.cursor:=null;
  update private.batch_work set cursor=null,scan_started_at=now() where batch_id=b.id;
 end if;
 update private.batch_work set poll_token=token,poll_until=now()+interval '90 seconds' where batch_id=b.id;
 return jsonb_build_object('batch_id',b.id,'provider_id',b.provider_batch_id,'cursor',w.cursor,'token',token);
end $$;
grant execute on function public.claim_event_poll() to service_role;

create function public.finish_event_poll(p_batch_id uuid,p_token uuid,p_events jsonb,p_issues jsonb,p_cursor text,p_more boolean) returns boolean
language plpgsql set search_path='' as $$
declare b public.provider_batches; w private.batch_work; a public.campaign_approvals;
 e jsonb; r public.approved_recipients; old_event public.provider_events; et text; eid text; occurred timestamptz; issue text; begin
 select * into b from public.provider_batches where id=p_batch_id for update;
 select * into w from private.batch_work where batch_id=b.id for update;
 if w.poll_token is distinct from p_token then return false; end if;
 if p_more and (p_cursor is null or p_cursor is not distinct from w.cursor) then raise exception 'Provider pagination did not advance'; end if;
 select * into a from public.campaign_approvals where id=b.approval_id;
 for e in select value from jsonb_array_elements(p_issues) loop
  insert into public.provider_event_issues(brand_id,batch_id,fingerprint,reason)
  values(b.brand_id,b.id,md5(e::text),left(e->>'reason',500)) on conflict do nothing;
 end loop;
 for e in select value from jsonb_array_elements(p_events) loop
  et:=e->>'type'; eid:=e->>'event_id'; issue:=null; occurred:=null;
  select * into r from public.approved_recipients where id::text=e->>'recipient_id' and brand_id=b.brand_id and approval_id=b.approval_id and batch_number=b.batch_number;
  if not found then issue:='Event recipient is not in this approved batch';
  elsif et not in ('delivered','bounced','opened','unsubscribed') or et is null then issue:='Unsupported event type';
  elsif nullif(e->>'channel','') is not null and e->>'channel'<>a.channel then issue:='Event channel does not match approved channel';
  end if;
  if issue is not null then
   insert into public.provider_event_issues(brand_id,batch_id,fingerprint,reason) values(b.brand_id,b.id,md5(e::text),issue) on conflict do nothing;
   continue;
  end if;
  begin occurred:=(e->>'occurred_at')::timestamptz; exception when invalid_datetime_format or datetime_field_overflow then occurred:=null; end;
  if eid is null or length(eid) not between 1 and 200 then
   eid:='fingerprint:'||md5(e::text); issue:='Event ID missing or invalid; deduplicated by content';
  end if;
  if occurred is null then issue:='Event timestamp missing or invalid; receipt time retained separately'; end if;
  select * into old_event from public.provider_events where batch_id=b.id and event_id=eid;
  if found and (old_event.recipient_id,old_event.event_type,old_event.occurred_at) is distinct from (r.id,et,occurred) then
   issue:='Provider reused an event ID with different contents';
   eid:='conflict:'||md5(e::text);
  end if;
  if issue is not null then
   insert into public.provider_event_issues(brand_id,batch_id,fingerprint,reason) values(b.brand_id,b.id,md5(e::text||issue),issue) on conflict do nothing;
  end if;
  insert into public.provider_events(brand_id,batch_id,event_id,recipient_id,event_type,occurred_at)
  values(b.brand_id,b.id,eid,r.id,et,occurred) on conflict do nothing;
  -- Monotonic facts: a late delivery or duplicate open never clears an opt-out/bounce.
  update public.approved_recipients set delivered=delivered or et='delivered',bounced=bounced or et='bounced',
   opened=opened or et='opened',unsubscribed=unsubscribed or et='unsubscribed' where id=r.id;
  if et in ('bounced','unsubscribed') then
   update public.contacts c set global_opt_out=global_opt_out or et='unsubscribed',
    email_bounced=email_bounced or (et='bounced' and a.channel='email'),
    sms_bounced=sms_bounced or (et='bounced' and a.channel='sms')
   where c.brand_id=b.brand_id and (c.id=r.contact_id or (a.channel='email' and c.email=r.destination) or (a.channel='sms' and c.phone=r.destination));
  end if;
 end loop;
 -- Each completed scan restarts from the beginning later, recovering late/backfilled events.
 update private.batch_work set cursor=case when p_more then p_cursor else null end,
  poll_after=now()+case when p_more then interval '0 seconds' else interval '5 minutes' end,poll_token=null,poll_until=null where batch_id=b.id;
 update public.provider_batches set last_synced_at=now(),last_error=null where id=b.id;
 return true;
end $$;
grant execute on function public.finish_event_poll(uuid,uuid,jsonb,jsonb,text,boolean) to service_role;
create function public.fail_event_poll(p_batch_id uuid,p_token uuid,p_reason text,p_delay integer) returns void
language plpgsql set search_path='' as $$ begin
 update private.batch_work set poll_after=now()+make_interval(secs=>greatest(30,least(86400,p_delay))),poll_token=null,poll_until=null
 where batch_id=p_batch_id and poll_token=p_token;
 if found then update public.provider_batches set last_error=left(p_reason,500) where id=p_batch_id; end if;
end $$;
grant execute on function public.fail_event_poll(uuid,uuid,text,integer) to service_role;

create view public.dispatch_metrics with(security_invoker=true) as
 select a.*,coalesce(r.queued,0) queued,coalesce(r.accepted,0) accepted,coalesce(r.rejected,0) rejected,coalesce(r.withheld,0) withheld,
 coalesce(r.delivered,0) delivered,coalesce(r.bounced,0) bounced,coalesce(r.opened,0) opened,coalesce(r.unsubscribed,0) unsubscribed,
 coalesce(b.attention,0) attention_batches,coalesce(b.pending,0) pending_batches,b.last_synced_at,coalesce(i.issue_count,0) issue_count,a.expires_at<=now() expired
 from public.campaign_approvals a
 left join (select brand_id,approval_id,count(*) filter(where submission_status='queued') queued,
 count(*) filter(where submission_status='accepted') accepted,count(*) filter(where submission_status='rejected') rejected,
 count(*) filter(where submission_status='withheld') withheld,count(*) filter(where delivered) delivered,
 count(*) filter(where bounced) bounced,count(*) filter(where opened) opened,count(*) filter(where unsubscribed) unsubscribed
 from public.approved_recipients group by brand_id,approval_id) r on r.brand_id=a.brand_id and r.approval_id=a.id
 left join (select brand_id,approval_id,count(*) filter(where status='attention') attention,
 count(*) filter(where status in ('queued','retry','sending')) pending,case when bool_or(status='accepted' and last_synced_at is null) then null else min(last_synced_at) end last_synced_at
 from public.provider_batches group by brand_id,approval_id) b on b.brand_id=a.brand_id and b.approval_id=a.id
 left join (select b.brand_id,b.approval_id,count(*) issue_count from public.provider_event_issues i
 join public.provider_batches b on b.id=i.batch_id and b.brand_id=i.brand_id group by b.brand_id,b.approval_id) i on i.brand_id=a.brand_id and i.approval_id=a.id;
grant select on public.dispatch_metrics to authenticated,service_role;
notify pgrst,'reload schema';

-- M6: a report password authorizes a narrow aggregate DTO, never a Supabase identity.
create extension if not exists pgcrypto with schema extensions;
create table public.shared_reports (
 id uuid primary key default gen_random_uuid(),
 brand_id uuid not null,
 campaign_id uuid not null,
 version integer not null default 1,
 active boolean not null default true,
 published_at timestamptz not null default now(),
 published_by uuid not null references auth.users(id),
 unique(brand_id,campaign_id),
 foreign key(brand_id,campaign_id) references public.campaigns(brand_id,id)
);
alter table public.shared_reports enable row level security;
create policy tenant_read on public.shared_reports for select to authenticated using(brand_id=(select private.current_brand_id()));
grant select on public.shared_reports to authenticated;
grant all on public.shared_reports to service_role;
create table private.report_credentials (
 report_id uuid primary key references public.shared_reports(id),
 password_hash text not null
);
create table private.report_attempts (
 key text primary key,
 attempts integer not null,
 created_at timestamptz not null default now()
);
create index report_attempts_created_idx on private.report_attempts(created_at);
alter table private.report_credentials enable row level security;
alter table private.report_attempts enable row level security;
grant all on private.report_credentials,private.report_attempts to service_role;

create function private.publish_report(p_campaign_id uuid,p_password text) returns uuid
language plpgsql security definer set search_path='' as $$
declare c public.campaigns; rid uuid; begin
 select * into c from public.campaigns where id=p_campaign_id for update;
 perform private.require_owner(c.brand_id);
 if p_password is null or length(p_password)<12 or octet_length(p_password)>64 then raise exception 'Use a password of at least 12 characters and no more than 64 UTF-8 bytes'; end if;
 insert into public.shared_reports(brand_id,campaign_id,published_by) values(c.brand_id,c.id,auth.uid())
 on conflict(brand_id,campaign_id) do update set version=shared_reports.version+1,active=true,published_at=now(),published_by=auth.uid()
 returning id into rid;
 insert into private.report_credentials(report_id,password_hash) values(rid,extensions.crypt(p_password,extensions.gen_salt('bf',12)))
 on conflict(report_id) do update set password_hash=excluded.password_hash;
 return rid;
end $$;
create function public.publish_report(p_campaign_id uuid,p_password text) returns uuid language sql set search_path='' as $$ select private.publish_report(p_campaign_id,p_password) $$;
grant execute on function private.publish_report(uuid,text),public.publish_report(uuid,text) to authenticated;
create function private.revoke_report(p_report_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare b uuid; begin
 select brand_id into b from public.shared_reports where id=p_report_id;
 perform private.require_owner(b);
 update public.shared_reports set active=false,version=version+1 where id=p_report_id;
end $$;
create function public.revoke_report(p_report_id uuid) returns void language sql set search_path='' as $$ select private.revoke_report(p_report_id) $$;
grant execute on function private.revoke_report(uuid),public.revoke_report(uuid) to authenticated;

create function private.report_attempt(p_key text) returns integer language sql set search_path='' as $$
 insert into private.report_attempts(key,attempts) values(p_key,1)
 on conflict(key) do update set attempts=report_attempts.attempts+1 returning attempts
$$;
grant execute on function private.report_attempt(text) to service_role;
create function public.verify_report_password(p_report_id uuid,p_password text,p_attempt_key text) returns jsonb
language plpgsql set search_path='' as $$
declare report public.shared_reports; hash text; bucket text:=floor(extract(epoch from now())/900)::bigint::text; begin
 if p_attempt_key is null or p_attempt_key !~ '^[a-f0-9]{64}$' then return null; end if;
 delete from private.report_attempts where created_at<now()-interval '1 day';
 -- The per-client guard runs before creating keys for arbitrary report IDs.
 if private.report_attempt('client:'||p_attempt_key||':'||bucket)>30 then return null; end if;
 if private.report_attempt('report:'||p_report_id::text||':'||bucket)>100 then return null; end if;
 if private.report_attempt('pair:'||p_report_id::text||':'||p_attempt_key||':'||bucket)>8 then return null; end if;
 if p_password is null or length(p_password)<12 or octet_length(p_password)>64 then return null; end if;
 select * into report from public.shared_reports where id=p_report_id and active;
 if not found then return null; end if;
 select password_hash into hash from private.report_credentials where report_id=report.id;
 if hash is null or extensions.crypt(p_password,hash) is distinct from hash then return null; end if;
 return jsonb_build_object('report_id',report.id,'version',report.version);
end $$;
grant execute on function public.verify_report_password(uuid,text,text) to service_role;

create function public.read_shared_report(p_report_id uuid,p_version integer) returns jsonb
language sql stable set search_path='' as $$
 select jsonb_build_object(
  'campaign_name',c.name,'brand_name',b.name,'channel',c.channel,'historical_date',c.sent_at,
  'reported',jsonb_build_object('sent',c.reported_sent,'delivered',c.reported_delivered,'bounced',c.reported_bounced,'opens',c.reported_opens,'clicks',c.reported_clicks),
  'observed',jsonb_build_object('opens',c.observed_unique_opens,'clicks',c.observed_unique_clicks,'unsubscribes',c.observed_unique_unsubscribes,'bounces',c.observed_unique_bounces),
  'live',case when d.id is null then null else jsonb_build_object('approved_at',d.approved_at,'approved',d.recipient_count,'accepted',d.accepted,'queued',d.queued,'rejected',d.rejected,'withheld',d.withheld,'delivered',d.delivered,'bounced',d.bounced,'opens',d.opened,'unsubscribed',d.unsubscribed,'last_synced_at',d.last_synced_at) end
 )
 from public.shared_reports r
 join public.campaign_metrics c on c.id=r.campaign_id and c.brand_id=r.brand_id
 join public.brands b on b.id=r.brand_id
 left join public.dispatch_metrics d on d.campaign_id=c.id and d.brand_id=c.brand_id and d.approved_at is not null
 where r.id=p_report_id and r.version=p_version and r.active
$$;
grant execute on function public.read_shared_report(uuid,integer) to service_role;
notify pgrst,'reload schema';

-- Per-schema defaults cannot remove PostgreSQL's global PUBLIC EXECUTE grant.
-- Deny new functions globally, then expose only the deliberate portal surface.
alter default privileges for role postgres revoke execute on functions from public, anon, authenticated;
revoke execute on all functions in schema public, private from public, anon, authenticated;

grant execute on function
  private.current_brand_id(),
  private.require_owner(uuid),
  private.prepare_campaign(uuid,boolean),
  private.confirm_campaign(uuid,integer,text),
  private.retry_campaign(uuid),
  private.publish_report(uuid,text),
  private.revoke_report(uuid),
  public.search_contacts(text,text,text,integer),
  public.dashboard_summary(),
  public.prepare_campaign(uuid,boolean),
  public.confirm_campaign(uuid,integer,text),
  public.retry_campaign(uuid),
  public.publish_report(uuid,text),
  public.revoke_report(uuid)
to authenticated;

-- Existing explicit service_role grants remain in place. Table RLS and owner
-- checks are independent protections, never substitutes for these RPC grants.
notify pgrst, 'reload schema';
