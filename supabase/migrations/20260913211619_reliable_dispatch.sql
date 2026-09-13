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
