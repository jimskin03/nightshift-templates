/* Nightshift Cafe renderer: dependency-free, strict and iframe-safe. */
(() => {
  const manifestReady = window.NightshiftCafeManifest;
  const validColor = value => /^#[0-9a-f]{6}$/i.test(value);
  const validate = (input, manifest) => {
    const errors = [];
    if (!input || typeof input !== 'object' || Array.isArray(input)) return ['Configuration must be an object.'];
    const fields = manifest.fields;
    Object.entries(fields).forEach(([key, rule]) => {
      const value = input[key];
      if (rule.type === 'string' && (typeof value !== 'string' || !value.trim())) errors.push(`${key} is required.`);
      if (rule.maxLength && typeof value === 'string' && value.length > rule.maxLength) errors.push(`${key} is too long.`);
      if (rule.type === 'color' && !validColor(value)) errors.push('accent must be a six-digit hex colour.');
      if (rule.type === 'array' && (!Array.isArray(value) || value.length < rule.minItems || value.length > rule.maxItems)) errors.push(`menu must contain ${rule.minItems}–${rule.maxItems} items.`);
    });
    const itemRules = fields.menu?.items?.properties || {};
    if (Array.isArray(input.menu)) input.menu.forEach((item, i) => {
      Object.entries(itemRules).forEach(([key, rule]) => {
        if (!item || typeof item[key] !== 'string' || !item[key].trim()) errors.push(`menu item ${i + 1} needs a ${key}.`);
        if (rule.maxLength && typeof item?.[key] === 'string' && item[key].length > rule.maxLength) errors.push(`menu item ${i + 1} is too long.`);
      });
    });
    return errors;
  };
  const text = (selector, value) => { const node = document.querySelector(selector); if (node) node.textContent = value; };
  const render = async config => {
    const manifest = await manifestReady;
    const errors = validate(config, manifest); if (errors.length) return { ok: false, errors };
    document.documentElement.style.setProperty('--accent', config.accent);
    document.querySelectorAll('[data-nightshift="brandName"]').forEach(n => n.textContent = config.brandName);
    text('[data-nightshift="tagline"]', config.tagline); text('[data-nightshift="hours"]', config.hours); text('[data-nightshift="address"]', config.address);
    const menu = document.querySelector('[data-nightshift-list="menu"]');
    if (menu) menu.replaceChildren(...config.menu.map(item => { const article = document.createElement('article'); article.className = 'menu-card'; article.innerHTML = '<h3></h3><p></p>'; article.querySelector('h3').textContent = item.name; article.querySelector('p').textContent = item.description; return article; }));
    return { ok: true, errors: [] };
  };
  window.NightshiftCafe = { manifestReady, validate: input => manifestReady.then(manifest => validate(input, manifest)), render };
})();
