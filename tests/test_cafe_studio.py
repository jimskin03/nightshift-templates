from pathlib import Path

ROOT = Path(__file__).parents[1]


def test_cafe_studio_is_legacy_redirect_only():
    page = (ROOT / 'cafe/studio.html').read_text()
    assert '/studio/?template=' in page
    assert "location.replace" in page


def test_universal_studio_uses_real_template_iframe():
    html = (ROOT / 'studio/index.html').read_text()
    js = (ROOT / 'studio/studio.js').read_text()
    assert 'id="preview"' in html
    assert 'state.manifest.entry' in js
    assert 'contentDocument' in js
    assert 'preview.html' not in js


def test_editor_is_manifest_driven():
    js = (ROOT / 'studio/studio.js').read_text()
    assert 'Object.entries(state.manifest.fields)' in js
    assert 'manifest.bindings' in js
    assert 'NightshiftCafeManifest' not in js
