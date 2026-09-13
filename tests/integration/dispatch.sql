-- Every fixture, queued job, and delivery event rolls back, including on the hosted project.
begin;
delete from pgmq.q_campaign_dispatch;
update private.batch_work set poll_after=now()+interval '1 day';
delete from public.memberships;
insert into auth.users(id,email) values
 ('dddddddd-0000-4000-8000-000000000001','dispatch-owner@example.test'),
 ('dddddddd-0000-4000-8000-000000000002','dispatch-analyst@example.test');
insert into public.memberships(user_id,brand_id,role,display_name) values
 ('dddddddd-0000-4000-8000-000000000001','33333333-3333-4333-8333-333333333333','owner','Dispatch owner'),
 ('dddddddd-0000-4000-8000-000000000002','33333333-3333-4333-8333-333333333333','analyst','Dispatch analyst');
insert into public.import_runs(id,brand_id,file_name,sha256,kind,encoding,status) values
 ('dddddddd-dddd-4ddd-8ddd-dddddddddddd','33333333-3333-4333-8333-333333333333','dispatch-test.csv',repeat('d',64),'contacts','UTF-8','complete');
insert into public.contacts(brand_id,external_id,full_name,email,country,status,consent_marketing,source_priority,import_run_id) values
 ('33333333-3333-4333-8333-333333333333','DISPATCH-1','One','one@dispatch.test','ZZ','active',true,1,'dddddddd-dddd-4ddd-8ddd-dddddddddddd'),
 ('33333333-3333-4333-8333-333333333333','DISPATCH-2','Two','two@dispatch.test','ZZ','active',true,1,'dddddddd-dddd-4ddd-8ddd-dddddddddddd'),
 ('33333333-3333-4333-8333-333333333333','DISPATCH-3','Three','three@dispatch.test','ZZ','active',true,1,'dddddddd-dddd-4ddd-8ddd-dddddddddddd'),
 ('33333333-3333-4333-8333-333333333333','DISPATCH-DUP','Duplicate','one@dispatch.test','ZZ','active',true,1,'dddddddd-dddd-4ddd-8ddd-dddddddddddd'),
 ('33333333-3333-4333-8333-333333333333','DISPATCH-SHARED','Shared','shared@dispatch.test','ZZ','active',true,1,'dddddddd-dddd-4ddd-8ddd-dddddddddddd'),
 ('33333333-3333-4333-8333-333333333333','DISPATCH-OPTOUT','Opted out','shared@dispatch.test','ZZ','unsubscribed',false,1,'dddddddd-dddd-4ddd-8ddd-dddddddddddd');
insert into public.campaigns(id,brand_id,external_id,name,channel,target_country,reported_sent,reported_delivered,reported_bounced,reported_opens,reported_clicks,spend_minor,sent_at,import_run_id) values
 ('dddddddd-0000-4000-8000-000000000004','33333333-3333-4333-8333-333333333333','DISPATCH-CAMPAIGN','Dispatch test','email','ZZ',0,0,0,0,0,0,now(),'dddddddd-dddd-4ddd-8ddd-dddddddddddd');
set local role authenticated;
select set_config('request.jwt.claim.sub','dddddddd-0000-4000-8000-000000000002',true);
do $$ begin
 begin perform public.prepare_campaign('dddddddd-0000-4000-8000-000000000004'); raise exception 'Analyst prepared a send'; exception when insufficient_privilege then null; end;
 begin perform public.claim_dispatch(); raise exception 'Analyst claimed private work'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','dddddddd-0000-4000-8000-000000000001',true);
select public.prepare_campaign('dddddddd-0000-4000-8000-000000000004');
do $$ declare a public.campaign_approvals; begin
 select * into a from public.campaign_approvals where campaign_id='dddddddd-0000-4000-8000-000000000004';
 assert a.recipient_count=3,'Audience did not deduplicate/exclude shared opt-out';
 begin perform public.confirm_campaign(a.id,4,a.audience_hash); raise exception 'Wrong count approved'; exception when raise_exception then if sqlerrm='Wrong count approved' then raise; end if; end;
 assert public.confirm_campaign(a.id,3,a.audience_hash)=a.id,'Confirmation lost the saved snapshot';
 assert public.confirm_campaign(a.id,3,a.audience_hash)=a.id,'Repeated confirmation made a second operation';
 assert (select count(*) from public.provider_batches where approval_id=a.id)=1,'Duplicate confirmation enqueued twice';
end $$;
reset role;
do $$ begin
 begin update public.campaign_approvals set recipient_count=1 where campaign_id='dddddddd-0000-4000-8000-000000000004'; raise exception 'Approval could be rewritten'; exception when raise_exception then if sqlerrm='Approval could be rewritten' then raise; end if; end;
 begin update public.approved_recipients set destination='replacement@dispatch.test' where destination='one@dispatch.test'; raise exception 'Audience could be rewritten'; exception when raise_exception then if sqlerrm='Audience could be rewritten' then raise; end if; end;
end $$;
-- Analysts cannot confirm an existing preview or resume another owner's operation.
set local role authenticated;
select set_config('request.jwt.claim.sub','dddddddd-0000-4000-8000-000000000002',true);
do $$ declare a public.campaign_approvals; begin
 select * into a from public.campaign_approvals where campaign_id='dddddddd-0000-4000-8000-000000000004';
 begin perform public.confirm_campaign(a.id,a.recipient_count,a.audience_hash); raise exception 'Analyst confirmed an approval'; exception when insufficient_privilege then null; end;
 begin perform public.retry_campaign(a.id); raise exception 'Analyst retried a send'; exception when insufficient_privilege then null; end;
end $$;
reset role;
-- Withdrawal after approval is accounted for separately; the approved count stays three.
update public.contacts set global_opt_out=true where external_id='DISPATCH-3';
set local role service_role;
do $$ declare work jsonb; again jsonb; poll jsonb; results jsonb; rid text; a uuid; begin
 work:=public.claim_dispatch();
 assert jsonb_array_length(work->'payload'->'recipients')=2,'Post-approval opt-out was sent';
 assert public.claim_dispatch() is null,'Concurrent worker acquired an active lease';
 assert not public.finish_dispatch((work->>'batch_id')::uuid,gen_random_uuid(),'test-provider','[]'),'Stale worker committed a result';
 assert public.fail_dispatch((work->>'batch_id')::uuid,(work->>'token')::uuid,'Network response lost',10,false),'Could not defer a failed request';
 -- Move the durable retry forward without waiting in a test.
 update public.provider_batches set next_attempt_at=now() where id=(work->>'batch_id')::uuid;
 perform pgmq.set_vt('campaign_dispatch',(select queue_id from private.batch_work where batch_id=(work->>'batch_id')::uuid),0);
 again:=public.claim_dispatch();
 assert again->'payload'=work->'payload' and again->>'idempotency_key'=work->>'idempotency_key','Retry changed the request or idempotency key';
 select jsonb_agg(jsonb_build_object('id',value->>'id','status','accepted')) into results from jsonb_array_elements(work->'payload'->'recipients');
 assert public.finish_dispatch((again->>'batch_id')::uuid,(again->>'token')::uuid,'test-provider',results),'Could not persist complete provider response';
 assert public.claim_dispatch() is null,'Completed job was not archived';
 poll:=public.claim_event_poll();
 rid:=work->'payload'->'recipients'->0->>'id';
 assert public.finish_event_poll((poll->>'batch_id')::uuid,(poll->>'token')::uuid,jsonb_build_array(
 jsonb_build_object('event_id','unsubscribe','recipient_id',rid,'type','unsubscribed','occurred_at',now()),
 jsonb_build_object('event_id','delivery','recipient_id',rid,'type','delivered','occurred_at',now()-interval '1 hour'),
 jsonb_build_object('event_id','delivery','recipient_id',rid,'type','delivered','occurred_at',now()-interval '1 hour'),
 jsonb_build_object('event_id','foreign','recipient_id',gen_random_uuid(),'type','bounced','occurred_at',now())
 ),'[]',null,false),'Event page was not saved';
 assert (select count(*) from public.provider_events where batch_id=(poll->>'batch_id')::uuid)=2,'Duplicate events inflated metrics';
 assert (select count(*) from public.provider_event_issues where batch_id=(poll->>'batch_id')::uuid)=1,'Unknown recipient silently accepted';
 assert (select unsubscribed and delivered from public.approved_recipients where id=rid::uuid),'Out-of-order delivery cleared opt-out';
 assert (select global_opt_out from public.contacts where id=(select contact_id from public.approved_recipients where id=rid::uuid)),'Opt-out did not change contactability';
 select approval_id into a from public.provider_batches where id=(work->>'batch_id')::uuid;
 assert (select recipient_count=3 and accepted=2 and withheld=1 from public.dispatch_metrics where id=a),'Approved and operational counts were conflated';
 assert (select cursor is null and poll_after>now() from private.batch_work where batch_id=(poll->>'batch_id')::uuid),'Finished scan will not rescan for late reports';
end $$;
rollback;
