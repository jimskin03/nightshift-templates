(() => {
  const $ = id => document.getElementById(id);
  const announce = msg => $('notice').textContent = msg;
  const previewWindow = () => $('preview').contentWindow;
  let manifest;
  let config;
  let ready = false;
  let requestId = 0;
  let latestAck = 0;

  const applyConstraints = () => {
    Object.entries(manifest.fields).forEach(([key, rule]) => {
      const node = $(key); if (!node) return;
      if (rule.maxLength) node.maxLength = rule.maxLength;
      node.required = rule.type === 'string';
    });
  };
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
  const readForm = () => {
    config = { ...Object.fromEntries(['brandName', 'tagline', 'hours', 'address', 'accent'].map(key => [key, $(key).value])), menu: [...document.querySelectorAll('.menu-row')].map(row => ({ name: row.children[0].value, description: row.children[1].value })) };
    return config;
  };
  const send = () => {
    if (!ready) return;
    const id = ++requestId; latestAck = id;
    previewWindow().postMessage({ channel: 'nightshift-preview', type: 'NIGHTSHIFT_PREVIEW_UPDATE', requestId: id, config: readForm() }, location.origin);
  };
  window.addEventListener('message', event => {
    if (event.origin !== location.origin || event.source !== previewWindow() || event.data?.channel !== 'nightshift-preview') return;
    if (event.data.type === 'NIGHTSHIFT_PREVIEW_READY') { ready = true; $('preview-status').textContent = 'Preview connected · changes are local only'; send(); return; }
    if (event.data.type !== 'NIGHTSHIFT_PREVIEW_ACK' || event.data.requestId !== latestAck) return;
    $('errors').textContent = event.data.ok ? '' : event.data.errors.join(' ');
    $('preview-status').textContent = event.data.ok ? 'Preview updated · not published' : 'Preview needs a correction';
  });
  $('editor-form').addEventListener('input', send);
  $('save').addEventListener('click', () => { readForm(); localStorage.setItem('nightshift:cafe:draft', JSON.stringify(config)); announce('Draft saved locally. Backend configuration pending; no Supabase write was attempted.'); });
  $('publish').addEventListener('click', () => announce('Publish is unavailable until backend configuration is applied. Nothing was sent.'));
  window.NightshiftCafeManifest.then(loaded => {
    manifest = loaded; config = structuredClone(manifest.defaults);
    try { const saved = JSON.parse(localStorage.getItem('nightshift:cafe:draft')); if (saved) config = saved; } catch (_) { /* ignore malformed local drafts */ }
    renderForm();
  }).catch(() => announce('Cafe manifest could not be loaded. This local preview is unavailable.'));
})();
