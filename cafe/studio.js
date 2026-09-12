(() => {
  const $ = id => document.getElementById(id);
  const announce = msg => $('notice').textContent = msg;
  const previewWindow = () => $('preview').contentWindow;
  let manifest;
  let config;
  let ready = false;
  let requestId = 0;
  let latestAck = 0;
  let adapter;
  let authenticated = false;

  const setEditorEnabled = enabled => {
    $('editor-form').querySelectorAll('input, textarea, button').forEach(node => { node.disabled = !enabled; });
    $('save').disabled = !enabled;
    $('publish').disabled = !enabled;
  };
  const applyConstraints = () => Object.entries(manifest.fields).forEach(([key, rule]) => {
    const node = $(key); if (!node) return;
    if (rule.maxLength) node.maxLength = rule.maxLength;
    node.required = rule.type === 'string';
  });
  const renderForm = () => {
    applyConstraints();
    ['brandName', 'tagline', 'hours', 'address', 'accent'].forEach(key => $(key).value = config[key]);
    const itemRules = manifest.fields.menu.items.properties;
    $('menu-fields').replaceChildren(...config.menu.map((item, i) => {
      const row = document.createElement('div'); row.className = 'menu-row field';
      row.innerHTML = `<input class="input" aria-label="Menu item ${i + 1} name"><input class="input" aria-label="Menu item ${i + 1} description">`;
      Object.entries(itemRules).forEach(([key, rule], index) => { if (rule.maxLength) row.children[index].maxLength = rule.maxLength; row.children[index].required = true; row.children[index].value = item[key]; });
      return row;
    }));
  };
  const readForm = () => { config = { ...Object.fromEntries(['brandName', 'tagline', 'hours', 'address', 'accent'].map(key => [key, $(key).value])), menu: [...document.querySelectorAll('.menu-row')].map(row => ({ name: row.children[0].value, description: row.children[1].value })) }; return config; };
  const send = () => {
    if (!ready || !authenticated) return;
    const id = ++requestId; latestAck = id;
    previewWindow().postMessage({ channel: 'nightshift-preview', type: 'NIGHTSHIFT_PREVIEW_UPDATE', requestId: id, config: readForm() }, location.origin);
  };
  window.addEventListener('message', event => {
    if (event.origin !== location.origin || event.source !== previewWindow() || event.data?.channel !== 'nightshift-preview') return;
    if (event.data.type === 'NIGHTSHIFT_PREVIEW_READY') { ready = true; $('preview-status').textContent = 'Preview connected · backend writes pending'; send(); return; }
    if (event.data.type !== 'NIGHTSHIFT_PREVIEW_ACK' || event.data.requestId !== latestAck) return;
    $('errors').textContent = event.data.ok ? '' : event.data.errors.join(' ');
    $('preview-status').textContent = event.data.ok ? 'Preview updated · not published' : 'Preview needs a correction';
  });
  $('editor-form').addEventListener('input', send);
  $('save').addEventListener('click', async () => { readForm(); try { await adapter.save(config); } catch (error) { announce(error.code === 'BACKEND_NOT_APPLIED' ? 'Save unavailable: backend configuration pending. No write was attempted.' : error.message); } });
  $('publish').addEventListener('click', async () => { try { await adapter.publish(config); } catch (error) { announce(error.code === 'BACKEND_NOT_APPLIED' ? 'Publish is unavailable until backend configuration is applied. Nothing was sent.' : error.message); } });

  window.NightshiftCafeManifest.then(async loaded => {
    manifest = loaded; config = structuredClone(manifest.defaults); renderForm();
    try {
      adapter = window.NightshiftAuthAdapter.create();
      const user = await adapter.getSessionUser();
      authenticated = Boolean(user);
      $('auth-required').hidden = authenticated;
      $('auth-user').hidden = !authenticated;
      $('auth-user').textContent = authenticated ? `Signed in as ${user.email || 'CryptGreg user'}` : '';
      setEditorEnabled(authenticated);
      announce(authenticated ? 'Signed in. Backend configuration pending; preview changes are not persisted.' : 'Sign in required to open the Cafe Studio editor.');
      if (authenticated) send();
    } catch (error) { setEditorEnabled(false); announce(`Authentication unavailable: ${error.message}`); }
  }).catch(() => announce('Cafe manifest could not be loaded. This local preview is unavailable.'));
})();
