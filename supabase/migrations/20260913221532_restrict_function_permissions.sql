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
