from pathlib import Path

ROOT = Path(__file__).parents[1]


def test_adapter_is_universal_and_client_only():
    adapter = (ROOT / "shared/auth-adapter.js").read_text()
    assert "NightshiftAuthAdapter" in adapter
    assert "service_role" not in adapter.lower()
    assert "template_slug=eq.cafe" not in adapter
    assert "p_template_slug: templateSlug" in adapter
    assert "sb_publishable_" in adapter


def test_studio_uses_shared_adapter_and_no_browser_storage():
    html = (ROOT / "studio/index.html").read_text()
    studio = (ROOT / "studio/studio.js").read_text()
    assert "/shared/auth-adapter.js" in html
    assert "NightshiftAuthAdapter.create" in studio
    assert "localStorage" not in studio
