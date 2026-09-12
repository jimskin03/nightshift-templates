import json
from pathlib import Path

ROOT = Path(__file__).parents[1]


def test_manifest_has_defaults_and_contract():
    manifest = json.loads((ROOT / 'cafe/nightshift.manifest.json').read_text())
    assert manifest['id'] == 'cafe'
    assert manifest['entry'] == 'index.html'
    assert manifest['preview'] == 'preview.html'
    assert set(manifest['defaults']) == set(manifest['fields'])
    assert 1 <= len(manifest['defaults']['menu']) <= 6


def test_original_cafe_page_is_preserved():
    page = (ROOT / 'cafe/index.html').read_text()
    assert 'Kopi Lane' in page and 'assets/hero.png' in page
    assert 'main.js' in page


def test_preview_protocol_is_origin_checked_and_isolated():
    studio = (ROOT / 'cafe/studio.html').read_text()
    script = (ROOT / 'cafe/preview.js').read_text()
    assert 'sandbox="allow-scripts allow-same-origin"' in studio
    assert "event.origin !== allowed" in script
    assert 'NIGHTSHIFT_PREVIEW_UPDATE' in script
    assert 'NIGHTSHIFT_PREVIEW_ACK' in script
    assert 'event.source === window.parent' in script
    assert 'latestRequestId' in script


def test_studio_rejects_untrusted_and_stale_preview_messages():
    script = (ROOT / 'cafe/studio.js').read_text()
    assert 'event.source !== previewWindow()' in script
    assert 'event.data.requestId !== latestAck' in script
    assert 'latestAck = id' in script


def test_manifest_is_loaded_as_the_runtime_contract():
    loader = (ROOT / 'cafe/manifest.js').read_text()
    studio = (ROOT / 'cafe/studio.js').read_text()
    renderer = (ROOT / 'cafe/renderer.js').read_text()
    assert 'nightshift.manifest.json' in loader
    assert 'structuredClone(manifest.defaults)' in studio
    assert 'manifest.fields' in studio
    assert 'manifestReady' in renderer


def test_renderer_has_bindings_and_validation():
    renderer = (ROOT / 'cafe/renderer.js').read_text()
    preview = (ROOT / 'cafe/preview.html').read_text()
    assert 'window.NightshiftCafe' in renderer
    assert 'data-nightshift="brandName"' in preview
    assert 'data-nightshift-list="menu"' in preview
    assert 'maxLength' in renderer


def test_controls_report_backend_pending():
    studio = (ROOT / 'cafe/studio.js').read_text()
    assert 'Backend configuration pending' in studio
    assert 'adapter.save' in studio
    assert 'adapter.publish' in studio
    assert 'Publish is unavailable until backend configuration is applied' in studio
    assert 'localStorage' not in studio
