/* Client-only Supabase browser-session adapter. Never add a service-role key here. */
(() => {
  const DEFAULT_URL = 'https://vlnocfdiexkqcnfbjhqt.supabase.co';
  const DEFAULT_PUBLISHABLE_KEY = 'sb_publishable_ys0Cl98LLqAdNEiNY1f7Mg_lddIzr6F';
  const API_ERROR = 'NIGHTSHIFT_API_ERROR';

  function runtimeConfig() {
    const supplied = window.NIGHTSHIFT_AUTH_CONFIG || {};
    const url = supplied.supabaseUrl || DEFAULT_URL;
    const key = supplied.publishableKey || DEFAULT_PUBLISHABLE_KEY;
    if (!/^https:\/\/[^\s/]+(?:\/[^\s]*)?$/.test(url)) throw new Error('Invalid Supabase URL');
    if (!/^(sb_publishable_[A-Za-z0-9_-]+|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/.test(key)) throw new Error('Invalid publishable key');
    return { supabaseUrl: url.replace(/\/$/, ''), publishableKey: key };
  }

  async function responseError(response, fallback) {
    let detail = '';
    try { const body = await response.json(); detail = body?.message || body?.error_description || body?.error || body?.hint || ''; } catch (_) { /* non-JSON error */ }
    const error = new Error(detail || `${fallback} (${response.status})`);
    error.code = API_ERROR; error.status = response.status;
    return error;
  }

  function createAuthAdapter(options = {}) {
    const config = runtimeConfig();
    const request = options.fetchImpl || window.fetch.bind(window);
    const headers = () => {
    const base = { apikey: config.publishableKey, Accept: 'application/json', 'Content-Type': 'application/json' };
    const match = (typeof document !== 'undefined' && document.cookie) ? document.cookie.match(/sb-[a-z0-9]+-auth-token=([^;]+)/) : null;
    if (match) {
      try {
        const session = JSON.parse(decodeURIComponent(match[1]));
        if (session && session.access_token && session.expires_at * 1000 > Date.now()) {
          base.Authorization = `Bearer ${session.access_token}`;
        }
      } catch (_) { /* unparseable session cookie; fall back to anonymous */ }
    }
    return base;
  };
    const call = async (path, init = {}, label = 'Request') => {
      const method = (init.method || 'GET').toUpperCase();
      const profileHeaders = method === 'GET' || method === 'HEAD'
        ? { 'Accept-Profile': 'nightshift' }
        : { 'Accept-Profile': 'nightshift', 'Content-Profile': 'nightshift' };
      const response = await request(`${config.supabaseUrl}${path}`, {
        credentials: 'omit', ...init, headers: { ...headers(), ...profileHeaders, ...(init.headers || {}) }
      });
      if (!response.ok) throw await responseError(response, `${label} failed`);
      if (response.status === 204) return null;
      return response.json();
    };
    return Object.freeze({
      config: Object.freeze({ ...config }),
      async getSessionUser() {
        const response = await request(`${config.supabaseUrl}/auth/v1/user`, { method: 'GET', credentials: 'omit', headers: headers() });
        if (response.status === 401 || response.status === 403) return null;
        if (!response.ok) throw await responseError(response, 'Session request failed');
        const user = await response.json(); return user && user.id ? user : null;
      },
      async listSites() { return call('/rest/v1/sites?select=id,name,slug,status,updated_at,template_slug&template_slug=eq.cafe&order=updated_at.desc', {}, 'Gallery load'); },
      async load(siteId) {
        if (!siteId) throw new Error('A site is required');
        const rows = await call(`/rest/v1/sites?select=id,name,slug,status,draft_data,updated_at&id=eq.${encodeURIComponent(siteId)}&template_slug=eq.cafe`, {}, 'Draft load');
        if (!rows[0]) { const error = new Error('Site not found or not owned by this account'); error.code = 'SITE_NOT_FOUND'; throw error; }
        return rows[0];
      },
      async create(siteName) {
        return call('/rest/v1/rpc/create_site', { method: 'POST', body: JSON.stringify({ p_template_slug: 'cafe', p_site_name: siteName }) }, 'Create site');
      },
      async remainingCreationsToday() {
        const result = await call('/rest/v1/rpc/remaining_creations_today', { method: 'POST', body: '{}' }, 'Quota check');
        const value = Array.isArray(result) ? result[0] : result;
        return typeof value === 'object' && value !== null && 'remaining_today' in value ? value.remaining_today : value;
      },
      async save(siteId, draft) {
        const rows = await call(`/rest/v1/sites?id=eq.${encodeURIComponent(siteId)}&template_slug=eq.cafe`, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ draft_data: draft }) }, 'Save draft');
        if (!rows[0]) { const error = new Error('Draft was not saved; site is missing or not owned by this account'); error.code = 'SITE_NOT_FOUND'; throw error; }
        return rows[0];
      },
      async publish(siteId) {
        const result = await call('/rest/v1/rpc/publish_site', { method: 'POST', body: JSON.stringify({ p_site_id: siteId }) }, 'Publish');
        return Array.isArray(result) ? result[0] : result;
      }
    });
  }
  window.NightshiftAuthAdapter = Object.freeze({ create: createAuthAdapter, API_ERROR });
})();
