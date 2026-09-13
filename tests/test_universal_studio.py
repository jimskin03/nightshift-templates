import json
from pathlib import Path

ROOT = Path(__file__).parents[1]
SLUGS = ("cafe", "florist", "barber", "fitness", "trades")


def test_registry_exposes_every_current_vertical():
    registry = json.loads((ROOT / "shared/templates.json").read_text())
    assert [item["slug"] for item in registry] == list(SLUGS)


def test_every_template_has_v2_manifest_and_complete_defaults():
    for slug in SLUGS:
        manifest = json.loads((ROOT / slug / "nightshift.manifest.json").read_text())
        assert manifest["id"] == slug
        assert manifest["version"] == 2
        assert manifest["entry"] == "index.html"
        assert set(manifest["fields"]) == set(manifest["defaults"])
        assert manifest["bindings"]["lists"]["features"]["container"] == ".features"
        assert manifest["bindings"]["lists"]["galleryItems"]["container"] == ".gallery"
        assert 1 <= len(manifest["defaults"]["features"]) <= 6
        assert 1 <= len(manifest["defaults"]["galleryItems"]) <= 8


def test_studio_is_generic_and_previews_real_templates():
    html = (ROOT / "studio/index.html").read_text()
    js = (ROOT / "studio/studio.js").read_text()
    assert "/shared/auth-adapter.js" in html
    assert 'sandbox="allow-scripts allow-same-origin"' in html
    assert "templates.json" in js
    assert "state.manifest.entry" in js
    assert "contentDocument" in js
    assert "requestAnimationFrame" in js
    assert "NightshiftCafe" not in js
    assert "template_slug=eq.cafe" not in js


def test_preview_updates_do_not_write_to_backend():
    js = (ROOT / "studio/studio.js").read_text()
    changed_body = js[js.index("function changed()") : js.index("function setText")]
    assert "adapter.save" not in changed_body
    assert "requestAnimationFrame" in changed_body


def test_legacy_cafe_studio_redirects_to_universal_studio():
    html = (ROOT / "cafe/studio.html").read_text()
    assert "/studio/?template=" in html
    for slug in SLUGS:
        assert slug in html


def test_legacy_cafe_drafts_are_normalized_before_editing():
    js = (ROOT / "studio/studio.js").read_text()
    assert "function normalizeDraft" in js
    assert "draft.accent" in js and "draft.primaryColor" in js
    assert "draft.menu" in js and "draft.galleryItems" in js
    assert "draft.hours" in js and "draft.ctaTitle" in js
    assert "draft.address" in js and "draft.contactText" in js


def test_saved_site_state_cannot_be_reenabled_by_generic_ui_state():
    js = (ROOT / "studio/studio.js").read_text()
    assert "remainingSiteSlots" in js
    assert "!state.user || state.remainingSiteSlots === null || state.remainingSiteSlots === 0" in js
    assert "saved sites used" in js
