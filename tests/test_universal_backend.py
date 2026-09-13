from pathlib import Path

ROOT = Path(__file__).parents[1]
SQL = (ROOT / "supabase/migrations/0003_universal_templates.sql").read_text().lower()


def test_catalog_contains_all_current_templates():
    assert "nightshift.template_catalog" in SQL
    for slug in ("cafe", "florist", "barber", "fitness", "trades"):
        assert f"('{slug}'," in SQL


def test_cafe_only_constraint_is_replaced_by_catalog_fk():
    assert "drop constraint if exists sites_template_slug_check" in SQL
    assert "sites_template_slug_fkey" in SQL
    assert "references nightshift.template_catalog(slug)" in SQL


def test_create_site_is_generic_and_keeps_global_quota():
    assert "create or replace function nightshift.create_site" in SQL
    assert "where slug = p_template_slug and enabled = true" in SQL
    assert "p_template_slug <> 'cafe'" not in SQL
    assert "pg_advisory_xact_lock" in SQL
    assert "daily site creation limit reached" in SQL
    assert "site_creation_events" in SQL
    assert "template_version" in SQL
