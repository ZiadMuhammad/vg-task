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
