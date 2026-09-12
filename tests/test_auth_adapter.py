from pathlib import Path

ROOT = Path(__file__).parents[1]


def test_adapter_is_client_only_and_explicit():
    adapter = (ROOT / 'cafe/auth-adapter.js').read_text()
    assert 'credentials: \'include\'' in adapter
    assert 'getSessionUser' in adapter
    assert 'load()' in adapter and 'save()' in adapter and 'publish()' in adapter
    assert 'service_role' not in adapter.lower()
    assert 'sb_publishable_' in adapter


def test_studio_uses_adapter_and_requires_sign_in():
    html = (ROOT / 'cafe/studio.html').read_text()
    studio = (ROOT / 'cafe/studio.js').read_text()
    assert 'auth-adapter.js' in html
    assert 'NightshiftAuthAdapter' in studio
    assert 'Sign in required' in html
    assert 'localStorage' not in studio


def test_runtime_config_is_validated():
    adapter = (ROOT / 'cafe/auth-adapter.js').read_text()
    assert 'Invalid Supabase URL' in adapter
    assert 'Invalid publishable key' in adapter
    assert 'BACKEND_NOT_APPLIED' in adapter
