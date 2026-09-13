-- Run after installing vault secrets vg_project_url and vg_worker_secret.
-- This is environment configuration, deliberately separate from schema migrations.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
do $$ begin
 if not exists(select 1 from vault.decrypted_secrets where name='vg_project_url') or
    not exists(select 1 from vault.decrypted_secrets where name='vg_worker_secret') then
  raise exception 'Worker Vault secrets must be installed first';
 end if;
end $$;
select cron.schedule('vg-campaign-worker','* * * * *',$job$
 select net.http_post(
  url := (select decrypted_secret from vault.decrypted_secrets where name='vg_project_url') || '/functions/v1/campaign-worker',
  headers := jsonb_build_object('Content-Type','application/json','x-worker-secret',(select decrypted_secret from vault.decrypted_secrets where name='vg_worker_secret')),
  body := '{}'::jsonb,
  timeout_milliseconds := 65000
 );
$job$);
