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
