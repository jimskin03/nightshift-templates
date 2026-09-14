-- Mirrors production migration 20260914111737_optimize_nightshift_rls_and_priority_indexes.
-- Production is already updated; this file synchronizes repository history.
-- Requires the existing portfolio.trades table from the shared Portfolio schema.

drop policy if exists sites_owner_select on nightshift.sites;
create policy sites_owner_select on nightshift.sites
  for select to authenticated
  using (owner_id = (select auth.uid()));

drop policy if exists sites_owner_update on nightshift.sites;
create policy sites_owner_update on nightshift.sites
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

drop policy if exists sites_owner_delete on nightshift.sites;
create policy sites_owner_delete on nightshift.sites
  for delete to authenticated
  using (owner_id = (select auth.uid()));

drop policy if exists versions_owner_select on nightshift.site_versions;
create policy versions_owner_select on nightshift.site_versions
  for select to authenticated
  using (
    exists (
      select 1
      from nightshift.sites s
      where s.id = site_versions.site_id
        and s.owner_id = (select auth.uid())
    )
  );

drop policy if exists assets_owner_all on nightshift.assets;
create policy assets_owner_all on nightshift.assets
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create index if not exists portfolio_trades_account_security_idx
  on portfolio.trades(account_id, security_id);
create index if not exists nightshift_assets_site_idx
  on nightshift.assets(site_id);
create index if not exists nightshift_assets_owner_idx
  on nightshift.assets(owner_id);
