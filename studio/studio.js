(() => {
  const $ = id => document.getElementById(id);
  const clone = value => structuredClone(value);
  const state = {
    registry: [], manifests: new Map(), manifest: null, templateSlug: null,
    config: {}, savedConfig: {}, currentSite: null, sites: [],
    adapter: null, user: null, previewReady: false, previewTemplate: null,
    previewFrameToken: 0, dirty: false, remainingQuota: null
  };

  const announce = message => { $('notice').textContent = message; };
  const showError = message => { $('errors').textContent = message || ''; };
  const apiMessage = error => error?.message || 'Something went wrong. Please try again.';
  const setDirty = dirty => {
    state.dirty = dirty;
    $('dirty-badge').hidden = !dirty;
    $('save-state').textContent = dirty ? 'Unsaved changes' : (state.currentSite ? 'Saved' : 'Not saved');
  };
  const setPersistenceEnabled = () => {
    const enabled = Boolean(state.user && state.currentSite);
    $('save').disabled = !enabled;
    $('publish').disabled = !enabled;
    $('delete-site').disabled = !enabled;
    $('create-site').disabled = !state.user || state.remainingQuota === 0;
  };

  async function loadRegistry() {
    const response = await fetch('/shared/templates.json', { credentials: 'same-origin' });
    if (!response.ok) throw new Error(`Template registry failed to load (${response.status})`);
    state.registry = await response.json();
    const select = $('template-select');
    select.replaceChildren(...state.registry.map(item => {
      const option = document.createElement('option');
      option.value = item.slug;
      option.textContent = item.name;
      return option;
    }));
  }

  async function getManifest(slug) {
    if (state.manifests.has(slug)) return state.manifests.get(slug);
    const item = state.registry.find(entry => entry.slug === slug);
    if (!item) throw new Error(`Unknown template: ${slug}`);
    const response = await fetch(item.manifest, { credentials: 'same-origin' });
    if (!response.ok) throw new Error(`${item.name} manifest failed to load (${response.status})`);
    const manifest = await response.json();
    if (manifest.id !== slug || !manifest.fields || !manifest.defaults || !manifest.bindings) throw new Error(`${item.name} manifest is invalid`);
    state.manifests.set(slug, manifest);
    return manifest;
  }

  function normalizeDraft(manifest, site) {
    const draft = clone(site?.draft_data || {});
    if (manifest.id === 'cafe' && (site?.template_version || 1) < 2) {
      if (!draft.primaryColor && draft.accent) draft.primaryColor = draft.accent;
      if (!draft.ctaTitle && draft.hours) draft.ctaTitle = draft.hours;
      if (!draft.contactText && draft.address) draft.contactText = draft.address;
      if (!draft.galleryItems && Array.isArray(draft.menu)) {
        draft.galleryItems = draft.menu.map(item => ({
          label: item?.name || 'Menu',
          title: item?.name || '',
          description: item?.description || ''
        }));
      }
    }
    return draft;
  }

  function validateConfig(config, manifest) {
    const errors = [];
    Object.entries(manifest.fields).forEach(([key, rule]) => {
      const value = config[key];
      if (rule.required && rule.type !== 'array' && (!value || !String(value).trim())) errors.push(`${rule.label || key} is required.`);
      if (rule.maxLength && typeof value === 'string' && value.length > rule.maxLength) errors.push(`${rule.label || key} is too long.`);
      if (rule.type === 'color' && !/^#[0-9a-f]{6}$/i.test(value || '')) errors.push(`${rule.label || key} must be a six-digit hex colour.`);
      if (rule.type === 'array') {
        if (!Array.isArray(value)) errors.push(`${rule.label || key} must be a list.`);
        else {
          if (rule.minItems != null && value.length < rule.minItems) errors.push(`${rule.label || key} needs at least ${rule.minItems} item(s).`);
          if (rule.maxItems != null && value.length > rule.maxItems) errors.push(`${rule.label || key} allows at most ${rule.maxItems} item(s).`);
          value.forEach((item, index) => Object.entries(rule.items?.properties || {}).forEach(([itemKey, itemRule]) => {
            const itemValue = item?.[itemKey];
            if (itemRule.required && (!itemValue || !String(itemValue).trim())) errors.push(`${rule.label || key} item ${index + 1}: ${itemRule.label || itemKey} is required.`);
            if (itemRule.maxLength && typeof itemValue === 'string' && itemValue.length > itemRule.maxLength) errors.push(`${rule.label || key} item ${index + 1}: ${itemRule.label || itemKey} is too long.`);
          }));
        }
      }
    });
    return errors;
  }

  function inputFor(key, rule, value, onInput) {
    const wrap = document.createElement('div');
    wrap.className = 'field';
    const label = document.createElement('label');
    label.htmlFor = `field-${key}`;
    label.textContent = rule.label || key;
    const input = rule.type === 'textarea' ? document.createElement('textarea') : document.createElement('input');
    input.className = 'input';
    input.id = `field-${key}`;
    if (rule.type === 'textarea') input.rows = rule.rows || 3;
    else input.type = rule.type === 'color' ? 'color' : 'text';
    input.value = value ?? '';
    if (rule.maxLength) input.maxLength = rule.maxLength;
    input.required = Boolean(rule.required);
    input.addEventListener('input', () => onInput(input.value));
    wrap.append(label, input);
    if (rule.help) {
      const help = document.createElement('span');
      help.className = 'help'; help.textContent = rule.help; wrap.append(help);
    }
    return wrap;
  }

  function arrayEditor(key, rule) {
    const section = document.createElement('div');
    section.className = 'array-field';
    const header = document.createElement('div');
    header.className = 'array-header';
    const title = document.createElement('span');
    title.className = 'array-title'; title.textContent = rule.label || key;
    const add = document.createElement('button');
    add.type = 'button'; add.className = 'button mini'; add.textContent = 'Add item';
    const list = document.createElement('div'); list.className = 'array-list';
    const renderRows = () => {
      const items = Array.isArray(state.config[key]) ? state.config[key] : [];
      list.replaceChildren(...items.map((item, index) => {
        const row = document.createElement('div'); row.className = 'array-item';
        Object.entries(rule.items?.properties || {}).forEach(([itemKey, itemRule]) => {
          row.append(inputFor(`${key}-${index}-${itemKey}`, itemRule, item[itemKey], value => {
            state.config[key][index][itemKey] = value; changed();
          }));
        });
        const actions = document.createElement('div'); actions.className = 'array-item-actions';
        const move = (label, delta) => {
          const button = document.createElement('button'); button.type = 'button'; button.className = 'button mini'; button.textContent = label;
          button.disabled = index + delta < 0 || index + delta >= items.length;
          button.addEventListener('click', () => {
            const [entry] = state.config[key].splice(index, 1);
            state.config[key].splice(index + delta, 0, entry); renderRows(); changed();
          });
          return button;
        };
        const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'button danger mini'; remove.textContent = 'Remove';
        remove.disabled = items.length <= (rule.minItems || 0);
        remove.addEventListener('click', () => { state.config[key].splice(index, 1); renderRows(); changed(); });
        actions.append(move('↑', -1), move('↓', 1), remove); row.append(actions); return row;
      }));
      add.disabled = items.length >= (rule.maxItems ?? Infinity);
    };
    add.addEventListener('click', () => {
      const props = rule.items?.properties || {};
      const item = Object.fromEntries(Object.keys(props).map(itemKey => [itemKey, '']));
      state.config[key].push(item); renderRows(); changed();
    });
    header.append(title, add); section.append(header, list); renderRows(); return section;
  }

  function renderForm() {
    const form = $('editor-form'); form.replaceChildren();
    const groups = state.manifest.editor?.groups || ['Content'];
    groups.forEach((group, groupIndex) => {
      const fields = Object.entries(state.manifest.fields).filter(([, rule]) => (rule.group || 'Content') === group);
      if (!fields.length) return;
      const details = document.createElement('details'); details.className = 'field-group'; details.open = groupIndex < 2;
      const summary = document.createElement('summary'); summary.textContent = group; details.append(summary);
      const body = document.createElement('div'); body.className = 'field-group-body';
      fields.forEach(([key, rule]) => {
        if (rule.type === 'array') body.append(arrayEditor(key, rule));
        else body.append(inputFor(key, rule, state.config[key], value => { state.config[key] = value; changed(); }));
      });
      details.append(body); form.append(details);
    });
  }

  let previewScheduled = false;
  function changed() {
    setDirty(true);
    if (!previewScheduled) {
      previewScheduled = true;
      requestAnimationFrame(() => { previewScheduled = false; applyPreview(); });
    }
  }

  function setText(doc, selector, value) {
    doc.querySelectorAll(selector).forEach(node => { node.textContent = value ?? ''; });
  }

  function renderList(doc, binding, items) {
    const container = doc.querySelector(binding.container);
    if (!container) return;
    if (binding.kind === 'features') {
      container.replaceChildren(...items.map(item => {
        const node = doc.createElement('div'); node.className = 'feature';
        const icon = doc.createElement('div'); icon.className = 'ic'; icon.textContent = binding.icon || '✦';
        const h3 = doc.createElement('h3'); h3.textContent = item.title || '';
        const p = doc.createElement('p'); p.textContent = item.description || '';
        node.append(icon, h3, p); return node;
      }));
    } else if (binding.kind === 'gallery') {
      container.replaceChildren(...items.map(item => {
        const link = doc.createElement('a'); link.className = 'preview'; link.href = '#';
        const thumb = doc.createElement('div'); thumb.className = 'thumb';
        const label = doc.createElement('span'); label.textContent = item.label || ''; thumb.append(label);
        const body = doc.createElement('div'); body.className = 'body';
        const h3 = doc.createElement('h3'); h3.textContent = item.title || '';
        const p = doc.createElement('p'); p.textContent = item.description || '';
        const go = doc.createElement('span'); go.className = 'go'; go.textContent = binding.linkText || 'Find out more';
        body.append(h3, p, go); link.append(thumb, body); return link;
      }));
    }
  }

  function applyPreview() {
    if (!state.previewReady || !state.manifest) return;
    const frame = $('preview');
    let doc;
    try { doc = frame.contentDocument; } catch (_) { doc = null; }
    if (!doc?.documentElement) { $('preview-status').textContent = 'Preview unavailable'; return; }
    const errors = validateConfig(state.config, state.manifest);
    showError(errors.join(' '));
    const bindings = state.manifest.bindings;
    Object.entries(bindings.text || {}).forEach(([key, selectors]) => {
      (Array.isArray(selectors) ? selectors : [selectors]).forEach(selector => setText(doc, selector, state.config[key]));
    });
    Object.entries(bindings.cssVars || {}).forEach(([key, variables]) => {
      (Array.isArray(variables) ? variables : [variables]).forEach(variable => doc.documentElement.style.setProperty(variable, state.config[key]));
    });
    Object.entries(bindings.lists || {}).forEach(([key, binding]) => renderList(doc, binding, state.config[key] || []));
    const footer = doc.querySelector('.footer p');
    if (footer && state.config.brandName) footer.textContent = `© ${new Date().getFullYear()} ${state.config.brandName}. All rights reserved.`;
    $('preview-status').textContent = errors.length ? 'Preview updated · fix validation before saving' : 'Preview updated live';
  }

  function loadPreview(slug) {
    state.previewReady = false;
    state.previewTemplate = slug;
    $('preview-status').textContent = 'Loading real template…';
    const token = ++state.previewFrameToken;
    const frame = $('preview');
    frame.onload = () => {
      if (token !== state.previewFrameToken) return;
      state.previewReady = true;
      try {
        const doc = frame.contentDocument;
        doc?.addEventListener('click', event => event.preventDefault(), true);
        doc?.addEventListener('submit', event => event.preventDefault(), true);
      } catch (_) { /* status below reports failure if access is unavailable */ }
      applyPreview();
    };
    frame.src = `/${encodeURIComponent(slug)}/${state.manifest.entry || 'index.html'}?nightshift-preview=1`;
  }

  async function setTemplate(slug, config = null, { reloadPreview = true } = {}) {
    const manifest = await getManifest(slug);
    state.templateSlug = slug; state.manifest = manifest;
    $('template-select').value = slug;
    $('studio-title').textContent = `${manifest.name} Studio`;
    $('template-description').textContent = manifest.description || `Customize the ${manifest.name} template.`;
    state.config = { ...clone(manifest.defaults), ...(config ? clone(config) : {}) };
    state.savedConfig = clone(state.config);
    setDirty(false); renderForm();
    if (reloadPreview || state.previewTemplate !== slug) loadPreview(slug); else applyPreview();
  }

  function renderSiteOptions(preferredId = '') {
    const select = $('site-select');
    const unsaved = document.createElement('option'); unsaved.value = ''; unsaved.textContent = 'Unsaved preview';
    const options = state.sites.map(site => {
      const entry = state.registry.find(item => item.slug === site.template_slug);
      const option = document.createElement('option'); option.value = site.id;
      option.textContent = `${site.name} · ${entry?.name || site.template_slug} · ${site.status}`;
      return option;
    });
    select.replaceChildren(unsaved, ...options);
    select.value = preferredId || '';
  }

  async function updateQuota() {
    if (!state.user) { state.remainingQuota = null; $('quota').textContent = 'Sign in to create saved sites.'; $('create-site').disabled = true; return; }
    try {
      const remaining = await state.adapter.remainingCreationsToday();
      state.remainingQuota = Number(remaining);
      $('quota').textContent = `${remaining} of 5 site creations remaining today`;
      $('create-site').disabled = state.remainingQuota <= 0;
    } catch (error) {
      state.remainingQuota = null;
      $('quota').textContent = `Quota unavailable: ${apiMessage(error)}`;
      $('create-site').disabled = true;
    }
  }

  async function loadSites(preferredId = '') {
    if (!state.user) { state.sites = []; renderSiteOptions(); return; }
    state.sites = await state.adapter.listSites();
    renderSiteOptions(preferredId);
    await updateQuota();
    if (preferredId) await loadSite(preferredId);
  }

  async function loadSite(siteId) {
    if (!siteId) {
      state.currentSite = null;
      setPersistenceEnabled();
      await setTemplate($('template-select').value || state.templateSlug, null, { reloadPreview: state.previewTemplate !== ($('template-select').value || state.templateSlug) });
      announce('Unsaved preview. Create a site when you want to save this configuration.');
      return;
    }
    try {
      const site = await state.adapter.load(siteId);
      state.currentSite = site;
      await setTemplate(site.template_slug, normalizeDraft(await getManifest(site.template_slug), site), { reloadPreview: state.previewTemplate !== site.template_slug });
      $('site-select').value = site.id;
      setPersistenceEnabled();
      announce(`Loaded ${site.name}. Changes preview instantly; Save draft persists them.`);
    } catch (error) {
      state.currentSite = null; setPersistenceEnabled(); showError(apiMessage(error)); announce(`Site load failed: ${apiMessage(error)}`);
    }
  }

  function showSignedOut() {
    state.user = null; state.currentSite = null; state.sites = [];
    $('auth-panel').hidden = false; $('auth-user').hidden = true; $('sign-out').hidden = true;
    renderSiteOptions(); setPersistenceEnabled(); updateQuota();
  }

  async function loadAuthenticated() {
    state.user = await state.adapter.getSessionUser();
    if (!state.user) { showSignedOut(); announce('Preview is ready. Sign in to save or publish.'); return; }
    $('auth-panel').hidden = true; $('auth-user').hidden = false; $('sign-out').hidden = false;
    $('auth-user').textContent = `Signed in as ${state.user.email || 'CryptGreg user'}`;
    setPersistenceEnabled(); await loadSites(); announce('Signed in. Choose a saved site or create a new one.');
  }

  $('template-select').addEventListener('change', async event => {
    state.currentSite = null; renderSiteOptions(); setPersistenceEnabled();
    await setTemplate(event.target.value);
    const url = new URL(location.href); url.searchParams.set('template', event.target.value); history.replaceState(null, '', url);
    announce(`Editing an unsaved ${state.manifest.name} preview.`);
  });
  $('site-select').addEventListener('change', event => loadSite(event.target.value));

  $('create-site').addEventListener('click', async () => {
    const name = $('new-site-name').value.trim();
    if (!state.user) { announce('Sign in before creating a saved site.'); return; }
    if (!name) { announce('Enter a site name first.'); return; }
    $('create-site').disabled = true; announce(`Creating ${state.manifest.name} site…`);
    try {
      const result = await state.adapter.create(state.templateSlug, name);
      const created = Array.isArray(result) ? result[0] : result;
      $('new-site-name').value = '';
      await loadSites(created.id); announce(`${state.manifest.name} site created.`);
    } catch (error) { showError(apiMessage(error)); announce(`Create failed: ${apiMessage(error)}`); await updateQuota(); }
    finally { if (state.user) await updateQuota(); }
  });

  $('save').addEventListener('click', async () => {
    if (!state.currentSite) return;
    const errors = validateConfig(state.config, state.manifest);
    if (errors.length) { showError(errors.join(' ')); announce('Fix validation errors before saving.'); return; }
    $('save').disabled = true; $('save-state').textContent = 'Saving…';
    try {
      const saved = await state.adapter.save(state.currentSite.id, state.config, state.manifest.version);
      state.currentSite = { ...state.currentSite, ...saved }; state.savedConfig = clone(state.config); setDirty(false); announce('Draft saved.');
    } catch (error) { showError(apiMessage(error)); $('save-state').textContent = 'Save failed'; announce(`Save failed: ${apiMessage(error)}`); }
    finally { setPersistenceEnabled(); }
  });

  $('publish').addEventListener('click', async () => {
    if (!state.currentSite) return;
    const errors = validateConfig(state.config, state.manifest);
    if (errors.length) { showError(errors.join(' ')); announce('Fix validation errors before publishing.'); return; }
    $('publish').disabled = true; announce('Saving and publishing…');
    try {
      await state.adapter.save(state.currentSite.id, state.config, state.manifest.version);
      await state.adapter.publish(state.currentSite.id);
      state.savedConfig = clone(state.config); setDirty(false); await loadSites(state.currentSite.id); announce('Published successfully.');
    } catch (error) { showError(apiMessage(error)); announce(`Publish failed: ${apiMessage(error)}`); }
    finally { setPersistenceEnabled(); }
  });

  $('delete-site').addEventListener('click', async () => {
    if (!state.currentSite || !confirm(`Delete ${state.currentSite.name}? This cannot be undone.`)) return;
    const id = state.currentSite.id; $('delete-site').disabled = true; announce('Deleting site…');
    try { await state.adapter.deleteSite(id); state.currentSite = null; await loadSites(); await setTemplate(state.templateSlug); announce('Site deleted. Creation quota is unchanged.'); }
    catch (error) { showError(apiMessage(error)); announce(`Delete failed: ${apiMessage(error)}`); }
    finally { setPersistenceEnabled(); }
  });

  $('auth-form').addEventListener('submit', async event => {
    event.preventDefault(); const email = $('auth-email').value.trim(); const password = $('auth-password').value;
    $('auth-submit').disabled = true; announce('Signing in…');
    try { await state.adapter.signIn(email, password); await loadAuthenticated(); }
    catch (error) { showError(apiMessage(error)); announce(`Sign in failed: ${apiMessage(error)}`); }
    finally { $('auth-submit').disabled = false; }
  });

  $('auth-signup').addEventListener('click', async () => {
    const email = $('auth-email').value.trim(); const password = $('auth-password').value;
    if (!email || password.length < 8) { announce('Enter an email and a password of at least 8 characters.'); return; }
    $('auth-signup').disabled = true; announce('Creating account…');
    try {
      const result = await state.adapter.signUp(email, password);
      if (result?.session || result?.access_token) { await loadAuthenticated(); announce('Account created and signed in.'); }
      else announce('Account created. Check your email to confirm, then sign in.');
    } catch (error) { showError(apiMessage(error)); announce(`Sign up failed: ${apiMessage(error)}`); }
    finally { $('auth-signup').disabled = false; }
  });

  $('sign-out').addEventListener('click', async () => {
    await state.adapter.signOut(); showSignedOut(); announce('Signed out. Your current preview remains local until you leave the page.');
  });

  document.querySelectorAll('.device-button').forEach(button => button.addEventListener('click', () => {
    document.querySelectorAll('.device-button').forEach(item => item.classList.toggle('active', item === button));
    $('preview-shell').className = `preview-shell ${button.dataset.device}`;
  }));

  (async () => {
    try {
      await loadRegistry();
      const requested = new URLSearchParams(location.search).get('template');
      const slug = state.registry.some(item => item.slug === requested) ? requested : state.registry[0]?.slug;
      if (!slug) throw new Error('No Nightshift templates are registered.');
      await setTemplate(slug);
      state.adapter = window.NightshiftAuthAdapter.create();
      await loadAuthenticated();
    } catch (error) {
      showError(apiMessage(error)); announce(`Studio failed to initialize: ${apiMessage(error)}`);
    }
  })();
})();
