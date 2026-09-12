/* Client-only Supabase browser-session adapter. Never add a service-role key here. */
(() => {
  const DEFAULT_URL = 'https://vlnocfdiexkqcnfbjhqt.supabase.co';
  const DEFAULT_PUBLISHABLE_KEY = 'sb_publishable_ys0Cl98LLqAdNEiNY1fMg_lddIzr6F';
  const UNSUPPORTED = 'BACKEND_NOT_APPLIED';

  function runtimeConfig() {
    const supplied = window.NIGHTSHIFT_AUTH_CONFIG || {};
    const url = supplied.supabaseUrl || DEFAULT_URL;
    const key = supplied.publishableKey || DEFAULT_PUBLISHABLE_KEY;
    if (!/^https:\/\/[^\s/]+(?:\/[^\s]*)?$/.test(url)) throw new Error('Invalid Supabase URL');
    if (!/^(sb_publishable_[A-Za-z0-9_-]+|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/.test(key)) throw new Error('Invalid publishable key');
    return { supabaseUrl: url.replace(/\/$/, ''), publishableKey: key };
  }

  function unsupported(method) {
    const error = new Error(`${method} is unavailable until backend configuration is applied.`);
    error.code = UNSUPPORTED;
    return Promise.reject(error);
  }

  function createAuthAdapter(options = {}) {
    const config = runtimeConfig();
    const request = options.fetchImpl || window.fetch.bind(window);
    return Object.freeze({
      config: Object.freeze({ ...config }),
      async getSessionUser() {
        const response = await request(`${config.supabaseUrl}/auth/v1/user`, {
          method: 'GET', credentials: 'include',
          headers: { apikey: config.publishableKey, Accept: 'application/json' }
        });
        if (response.status === 401 || response.status === 403) return null;
        if (!response.ok) throw new Error(`Session request failed: ${response.status}`);
        const user = await response.json();
        return user && user.id ? user : null;
      },
      load() { return unsupported('Load'); },
      save() { return unsupported('Save'); },
      publish() { return unsupported('Publish'); }
    });
  }

  window.NightshiftAuthAdapter = Object.freeze({ create: createAuthAdapter, UNSUPPORTED });
})();
