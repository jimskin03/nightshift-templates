from pathlib import Path

ROOT = Path(__file__).parents[1]
MIGRATION = ROOT / "supabase/migrations/0001_nightshift_mvp.sql"


def migration() -> str:
    return MIGRATION.read_text()


def test_migration_defines_nightshift_schema_and_core_tables():
    sql = migration()
    assert "create schema if not exists nightshift" in sql.lower()
    for table in ("sites", "site_creation_events", "site_versions", "assets"):
        assert f"nightshift.{table}" in sql.lower()


def test_creation_rpc_enforces_authenticated_utc_daily_quota():
    sql = migration().lower()
    assert "create or replace function nightshift.create_site" in sql
    assert "auth.uid()" in sql
    assert "pg_advisory_xact_lock" in sql
    assert "date_trunc('day', now() at time zone 'utc')" in sql
    assert "daily site creation limit reached" in sql
    assert "site_creation_events" in sql


def test_ownership_rls_and_immutable_ledger_are_declared():
    sql = migration().lower()
    assert "enable row level security" in sql
    assert "owner_id = auth.uid()" in sql
    assert "append-only" in sql
    assert "create trigger" in sql


def test_publish_copies_draft_and_records_version():
    sql = migration().lower()
    assert "create or replace function nightshift.publish_site" in sql
    assert "published_data = v_site.draft_data" in sql
    assert "nightshift.site_versions" in sql


def test_rls_tables_are_granted_to_authenticated():
    # Supabase default privileges only cover `public`; without these grants
    # every RLS policy on the nightshift schema is inert for clients.
    sql = migration().lower()
    assert "grant select, update, delete on nightshift.sites to authenticated" in sql
    assert "grant select on nightshift.site_versions to authenticated" in sql
    assert "grant select, insert, update, delete on nightshift.assets to authenticated" in sql


def test_published_fields_cannot_be_set_by_direct_client_update():
    # sites_owner_update would otherwise let the owner write status /
    # published_at / published_data directly, bypassing publish_site and
    # its site_versions ledger. A guard trigger must reject that when the
    # statement runs as the client role (`authenticated`), while the
    # security definer publish RPC (running as the function owner) is
    # still allowed to write them.
    sql = migration().lower()
    assert "create or replace function nightshift.prevent_direct_publish_field_change" in sql
    assert "published fields can only be changed through nightshift.publish_site" in sql
    assert "create trigger sites_published_fields_protected" in sql
    assert "current_user = 'authenticated'" in sql
    # The guard must cover all three publish-owned columns.
    for col in ("status", "published_at", "published_data"):
        assert f"new.{col}" in sql


def test_asset_rows_must_reference_a_site_owned_by_the_asset_owner():
    # Without this check, an authenticated user can attach an asset row to
    # another user's site (owner_id = auth.uid() but site_id foreign).
    sql = migration().lower()
    assert "create or replace function nightshift.validate_asset_site_ownership" in sql
    assert "create trigger assets_site_ownership" in sql
    assert "before insert or update of site_id, owner_id on nightshift.assets" in sql
    assert "asset site_id must reference a site owned by the asset owner" in sql
    # It must compare the referenced site's owner against the asset owner.
    assert "v_owner is distinct from new.owner_id" in sql
