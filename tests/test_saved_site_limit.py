from pathlib import Path

ROOT = Path(__file__).parents[1]
SQL = (ROOT / "supabase/migrations/0004_saved_site_limit.sql").read_text().lower()
STUDIO = (ROOT / "studio/studio.js").read_text()
SHARED_ADAPTER = (ROOT / "shared/auth-adapter.js").read_text()
CAFE_ADAPTER = (ROOT / "cafe/auth-adapter.js").read_text()
CSS = (ROOT / "studio/studio.css").read_text()


def test_saved_site_limit_migration_counts_live_sites_not_history():
    assert "create or replace function nightshift.remaining_site_slots" in SQL
    remaining_fn = SQL[SQL.index("create or replace function nightshift.remaining_site_slots"):SQL.index("-- keep the old rpc")]
    assert "from nightshift.sites" in remaining_fn
    assert "site_creation_events" not in remaining_fn
    assert "saved site limit reached" in SQL
    create_fn = SQL[SQL.index("create or replace function nightshift.create_site"):]
    assert "from nightshift.sites" in create_fn


def test_legacy_quota_rpc_uses_saved_site_semantics():
    assert "create or replace function nightshift.remaining_creations_today" in SQL
    assert "from nightshift.sites" in SQL


def test_adapters_use_saved_site_slots_rpc():
    for adapter in (SHARED_ADAPTER, CAFE_ADAPTER):
        assert "remainingSiteSlots" in adapter
        assert "/rpc/remaining_site_slots" in adapter


def test_universal_ui_reports_saved_sites_and_releases_slot_on_delete():
    assert "remainingSiteSlots" in STUDIO
    assert "saved sites used" in STUDIO
    assert "site deleted. Creation quota is unchanged." not in STUDIO
    assert "Site deleted. You can create another saved site." in STUDIO


def test_hidden_auth_panel_is_reliably_hidden():
    assert ".auth-panel[hidden]" in CSS
