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
