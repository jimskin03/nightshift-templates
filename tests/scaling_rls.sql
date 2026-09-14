-- Run with psql -v ON_ERROR_STOP=1 -f tests/scaling_rls.sql as a database admin
-- against a disposable local database with migrations 0001-0005 applied.
-- Also runs before 0005 to verify that the ownership behavior is unchanged.
begin;

create function pg_temp.assert_true(ok boolean, message text)
returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'Assertion failed: %', message; end if;
end;
$$;

create function pg_temp.expect_denied(statement text)
returns void language plpgsql as $$
begin
  begin
    execute statement;
  exception when insufficient_privilege then
    return;
  end;
  raise exception 'Expected permission denial: %', statement;
end;
$$;

insert into auth.users(id) values
  ('00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000002');
insert into nightshift.sites(id, owner_id, template_slug, name, slug) values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'cafe', 'Owner A', 'rls-test-a'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', 'cafe', 'Owner B', 'rls-test-b');
insert into nightshift.site_versions(site_id, version, data) values
  ('10000000-0000-0000-0000-000000000001', 1, '{}'),
  ('10000000-0000-0000-0000-000000000002', 1, '{}');
insert into nightshift.assets(id, owner_id, site_id, object_path) values
  ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'rls-test-a'),
  ('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'rls-test-b');

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
select pg_temp.assert_true((select count(*) = 1 from nightshift.sites), 'A sees only own site');
select pg_temp.assert_true((select count(*) = 1 from nightshift.site_versions), 'A sees only own version');
select pg_temp.assert_true((select count(*) = 1 from nightshift.assets), 'A sees only own asset');
with changed as (
  update nightshift.sites set name = 'Updated A'
  where id = '10000000-0000-0000-0000-000000000001' returning id
) select pg_temp.assert_true((select count(*) = 1 from changed), 'owner can update site');
with changed as (
  update nightshift.sites set name = 'Forbidden'
  where id = '10000000-0000-0000-0000-000000000002' returning id
) select pg_temp.assert_true((select count(*) = 0 from changed), 'cannot update foreign site');
with removed as (
  delete from nightshift.sites where id = '10000000-0000-0000-0000-000000000002' returning id
) select pg_temp.assert_true((select count(*) = 0 from removed), 'cannot delete foreign site');
with changed as (
  update nightshift.assets set content_type = 'image/png'
  where id = '20000000-0000-0000-0000-000000000002' returning id
) select pg_temp.assert_true((select count(*) = 0 from changed), 'cannot update foreign asset');
with removed as (
  delete from nightshift.assets where id = '20000000-0000-0000-0000-000000000002' returning id
) select pg_temp.assert_true((select count(*) = 0 from removed), 'cannot delete foreign asset');

select pg_temp.expect_denied($q$
  insert into nightshift.assets(owner_id, site_id, object_path) values
  ('00000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'forbidden-owner')
$q$);
select pg_temp.expect_denied($q$
  insert into nightshift.assets(owner_id, site_id, object_path) values
  ('00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 'forbidden-site')
$q$);
select pg_temp.expect_denied($q$
  update nightshift.assets set site_id = '10000000-0000-0000-0000-000000000002'
  where id = '20000000-0000-0000-0000-000000000001'
$q$);
select pg_temp.expect_denied($q$
  update nightshift.assets set owner_id = '00000000-0000-0000-0000-000000000002'
  where id = '20000000-0000-0000-0000-000000000001'
$q$);

-- Isolate WITH CHECK from the existing ownership triggers in this rolled-back test.
reset role;
alter table nightshift.sites disable trigger sites_owner_immutable;
alter table nightshift.assets disable trigger assets_site_ownership;
set local role authenticated;
select pg_temp.expect_denied($q$
  update nightshift.sites set owner_id = '00000000-0000-0000-0000-000000000002'
  where id = '10000000-0000-0000-0000-000000000001'
$q$);
select pg_temp.expect_denied($q$
  update nightshift.assets set owner_id = '00000000-0000-0000-0000-000000000002'
  where id = '20000000-0000-0000-0000-000000000001'
$q$);
reset role;
alter table nightshift.sites enable trigger sites_owner_immutable;
alter table nightshift.assets enable trigger assets_site_ownership;
set local role authenticated;

insert into nightshift.assets(owner_id, site_id, object_path) values
  ('00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'allowed-new');
with changed as (
  update nightshift.assets set content_type = 'image/png' where object_path = 'allowed-new' returning id
) select pg_temp.assert_true((select count(*) = 1 from changed), 'owner can update asset');
with removed as (
  delete from nightshift.assets where object_path = 'allowed-new' returning id
) select pg_temp.assert_true((select count(*) = 1 from removed), 'owner can delete asset');

set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
select pg_temp.assert_true((select count(*) = 1 and bool_and(owner_id = auth.uid()) from nightshift.sites), 'B sees only own site');
select pg_temp.assert_true((select count(*) = 1 and bool_and(site_id = '10000000-0000-0000-0000-000000000002') from nightshift.site_versions), 'B sees only own version');
select pg_temp.assert_true((select count(*) = 1 and bool_and(owner_id = auth.uid()) from nightshift.assets), 'B sees only own asset');
with removed as (
  delete from nightshift.sites where id = '10000000-0000-0000-0000-000000000002' returning id
) select pg_temp.assert_true((select count(*) = 1 from removed), 'owner can delete site');
select pg_temp.assert_true((select count(*) = 0 from nightshift.site_versions), 'deleted site versions cascade');
select pg_temp.assert_true((select count(*) = 0 from nightshift.assets), 'deleted site assets cascade');

set local request.jwt.claim.sub = '';
select pg_temp.assert_true((select count(*) = 0 from nightshift.sites), 'null identity cannot read sites');
select pg_temp.assert_true((select count(*) = 0 from nightshift.site_versions), 'null identity cannot read versions');
select pg_temp.assert_true((select count(*) = 0 from nightshift.assets), 'null identity cannot read assets');
set local role anon;
select pg_temp.expect_denied('select * from nightshift.sites');
select pg_temp.expect_denied('select * from nightshift.site_versions');
select pg_temp.expect_denied('select * from nightshift.assets');
rollback;
\echo Ownership regression checks passed.
