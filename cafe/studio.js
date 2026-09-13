(() => {
  const $ = id => document.getElementById(id);
  const announce = message => { $('notice').textContent = message; };
  const previewWindow = () => $('preview').contentWindow;
  let manifest, config, ready = false, requestId = 0, latestAck = 0, adapter, user, currentSite;

  const setEditorEnabled = enabled => {
    $('editor-form').querySelectorAll('input, textarea, button').forEach(node => { node.disabled = !enabled; });
    $('save').disabled = !enabled; $('publish').disabled = !enabled;
  };
  const showError = message => { $('errors').textContent = message || ''; };
  const apiMessage = error => error?.code === 'SITE_NOT_FOUND' ? error.message : (error?.message || 'Something went wrong. Please try again.');
  const applyConstraints = () => Object.entries(manifest.fields).forEach(([key, rule]) => { const node = $(key); if (!node) return; if (rule.maxLength) node.maxLength = rule.maxLength; node.required = rule.type === 'string'; });
  const renderForm = () => {
    applyConstraints();
    ['brandName', 'tagline', 'hours', 'address', 'accent'].forEach(key => { $(key).value = config[key] || ''; });
    const itemRules = manifest.fields.menu.items.properties;
    $('menu-fields').replaceChildren(...(config.menu || []).map((item, i) => {
      const row = document.createElement('div'); row.className = 'menu-row field';
      ['name', 'description'].forEach((key, index) => { const input = document.createElement('input'); input.className = 'input'; input.setAttribute('aria-label', `Menu item ${i + 1} ${key}`); input.value = item[key] || ''; input.required = true; if (itemRules[key].maxLength) input.maxLength = itemRules[key].maxLength; row.append(input); });
      return row;
    }));
  };
  const readForm = () => { config = { ...Object.fromEntries(['brandName', 'tagline', 'hours', 'address', 'accent'].map(key => [key, $(key).value])), menu: [...document.querySelectorAll('.menu-row')].map(row => ({ name: row.children[0].value, description: row.children[1].value })) }; return config; };
  const send = () => { if (!ready || !currentSite) return; const id = ++requestId; latestAck = id; previewWindow().postMessage({ channel: 'nightshift-preview', type: 'NIGHTSHIFT_PREVIEW_UPDATE', requestId: id, config: readForm() }, location.origin); };
  const updateQuota = async () => { try { const remaining = await adapter.remainingCreationsToday(); $('quota').textContent = `${remaining} of 5 site creations remaining today`; $('create-site').disabled = remaining <= 0; } catch (error) { $('quota').textContent = `Quota unavailable: ${apiMessage(error)}`; $('create-site').disabled = true; } };
  const loadSite = async siteId => {
    if (!siteId) { currentSite = null; setEditorEnabled(false); $('delete-site').disabled = true; return; }
    try { currentSite = await adapter.load(siteId); config = { ...structuredClone(manifest.defaults), ...(currentSite.draft_data || {}) }; $('site-title').textContent = currentSite.name; renderForm(); setEditorEnabled(true); $('delete-site').disabled = false; showError(''); announce(`Loaded ${currentSite.name}. Draft belongs to your authenticated account.`); send(); }
    catch (error) { currentSite = null; setEditorEnabled(false); $('delete-site').disabled = true; announce(`Draft load failed: ${apiMessage(error)}`); showError(apiMessage(error)); }
  };
  const loadGallery = async preferredId => {
    const sites = await adapter.listSites(); const select = $('site-select'); select.replaceChildren();
    sites.forEach(site => { const option = document.createElement('option'); option.value = site.id; option.textContent = `${site.name} · ${site.status}`; select.append(option); });
    if (!sites.length) { const option = document.createElement('option'); option.value = ''; option.textContent = 'No sites yet — create your first Cafe'; select.append(option); }
    const id = preferredId || sites[0]?.id || ''; select.value = id; await loadSite(id); await updateQuota();
  };
  window.addEventListener('message', event => {
    if (event.origin !== location.origin || event.source !== previewWindow() || event.data?.channel !== 'nightshift-preview') return;
    if (event.data.type === 'NIGHTSHIFT_PREVIEW_READY') { ready = true; $('preview-status').textContent = 'Preview connected'; send(); return; }
    if (event.data.type === 'NIGHTSHIFT_PREVIEW_ACK' && event.data.requestId === latestAck) { showError(event.data.ok ? '' : event.data.errors.join(' ')); $('preview-status').textContent = event.data.ok ? 'Preview updated · draft changes not yet saved' : 'Preview needs a correction'; }
  });
  $('editor-form').addEventListener('input', send);
  $('site-select').addEventListener('change', event => loadSite(event.target.value));
  $('delete-site').addEventListener('click', async () => { if (!currentSite || !window.confirm(`Delete ${currentSite.name}? This cannot be undone.`)) return; const deletedId = currentSite.id; $('delete-site').disabled = true; announce('Deleting template…'); try { await adapter.deleteSite(deletedId); await loadGallery(); announce('Template deleted.'); } catch (error) { $('delete-site').disabled = false; announce(`Delete failed: ${apiMessage(error)}`); showError(apiMessage(error)); } });
  $('create-site').addEventListener('click', async () => { const name = $('new-site-name').value.trim(); if (!name) { announce('Enter a cafe name before creating a site.'); return; } $('create-site').disabled = true; announce('Creating Cafe…'); try { const result = await adapter.create(name); const created = Array.isArray(result) ? result[0] : result; $('new-site-name').value = ''; announce('Cafe created. Loading its draft…'); await loadGallery(created.id); } catch (error) { announce(`Create failed: ${apiMessage(error)}`); showError(apiMessage(error)); await updateQuota(); } finally { $('create-site').disabled = false; } });
  $('save').addEventListener('click', async () => { if (!currentSite) return; readForm(); $('save').disabled = true; announce('Saving draft…'); try { currentSite = await adapter.save(currentSite.id, config); announce('Draft saved to your account.'); } catch (error) { announce(`Save failed: ${apiMessage(error)}`); showError(apiMessage(error)); } finally { $('save').disabled = false; } });
  $('publish').addEventListener('click', async () => { if (!currentSite) return; readForm(); $('publish').disabled = true; announce('Publishing…'); try { await adapter.save(currentSite.id, config); await adapter.publish(currentSite.id); await loadGallery(currentSite.id); announce('Published successfully.'); } catch (error) { announce(`Publish failed: ${apiMessage(error)}`); showError(apiMessage(error)); } finally { $('publish').disabled = false; } });
  const loadAuthenticated = async () => { user = await adapter.getSessionUser(); if (!user) { $('auth-required').hidden = false; $('auth-panel').hidden = false; setEditorEnabled(false); announce('Sign in or create an account to load your sites.'); return false; } $('auth-required').hidden = true; $('auth-panel').hidden = true; $('auth-user').hidden = false; $('auth-user').textContent = `Signed in as ${user.email || 'CryptGreg user'}`; await loadGallery(); return true; };
  $('auth-form').addEventListener('submit', async event => { event.preventDefault(); const email = $('auth-email').value.trim(); const password = $('auth-password').value; $('auth-submit').disabled = true; announce('Signing in…'); try { await adapter.signIn(email, password); await loadAuthenticated(); announce('Signed in successfully.'); } catch (error) { announce(`Sign in failed: ${apiMessage(error)}`); showError(apiMessage(error)); } finally { $('auth-submit').disabled = false; } });
  $('auth-signup').addEventListener('click', async () => { const email = $('auth-email').value.trim(); const password = $('auth-password').value; if (!email || password.length < 8) { announce('Enter an email and a password of at least 8 characters.'); return; } $('auth-signup').disabled = true; announce('Creating account…'); try { const result = await adapter.signUp(email, password); if (result.session) { await loadAuthenticated(); announce('Account created and signed in.'); } else { announce('Account created. Check your email to confirm, then sign in here.'); } } catch (error) { announce(`Sign up failed: ${apiMessage(error)}`); showError(apiMessage(error)); } finally { $('auth-signup').disabled = false; } });

  window.NightshiftCafeManifest.then(async loaded => {
    manifest = loaded; config = structuredClone(manifest.defaults); renderForm(); setEditorEnabled(false);
    try { adapter = window.NightshiftAuthAdapter.create(); await loadAuthenticated(); }
    catch (error) { setEditorEnabled(false); announce(`Authentication or gallery unavailable: ${apiMessage(error)}`); }
  }).catch(error => announce(`Cafe manifest could not be loaded: ${apiMessage(error)}`));
})();
