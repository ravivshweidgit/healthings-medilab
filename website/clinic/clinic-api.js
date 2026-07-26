/**
 * Shared API client — same-origin on healthings.ai to avoid CORS issues.
 *
 * Two apps use this: the clinic portal, and the patient's own read-only view at
 * /account/. They keep their own token keys so a clinician and a patient sharing
 * a browser do not sign each other out.
 */
(function (global) {
  'use strict';

  const API =
    global.location && global.location.hostname.endsWith('healthings.ai')
      ? ''
      : 'https://api.healthings.ai';

  function createClient(tokenKey) {
    function loadTokens() {
      try {
        return JSON.parse(global.localStorage.getItem(tokenKey) || 'null');
      } catch {
        return null;
      }
    }

    function saveTokens(access, refresh) {
      global.localStorage.setItem(tokenKey, JSON.stringify({ access, refresh }));
    }

    function clearTokens() {
      global.localStorage.removeItem(tokenKey);
    }

    async function api(path, opts = {}) {
      const method = opts.method || 'GET';
      const body = opts.body;

      async function request(accessToken) {
        const headers = { ...(opts.headers || {}) };
        if (body != null) headers['Content-Type'] = 'application/json';
        if (accessToken) headers.Authorization = 'Bearer ' + accessToken;
        const init = { method, headers };
        if (body != null) init.body = body;
        return global.fetch(API + path, init);
      }

      const tokens = loadTokens();
      let res = await request(tokens?.access);
      if (res.status === 401 && tokens?.refresh) {
        const r = await global.fetch(API + '/v1/auth/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: tokens.refresh }),
        });
        if (r.ok) {
          const data = await r.json();
          saveTokens(data.accessToken, data.refreshToken);
          res = await request(data.accessToken);
        } else {
          clearTokens();
        }
      }
      return res;
    }

    return { API, TOKEN_KEY: tokenKey, api, loadTokens, saveTokens, clearTokens };
  }

  global.HealthingsApi = { API, createClient };
  global.ClinicApi = createClient('healthings_clinic_tokens');
})(typeof window !== 'undefined' ? window : globalThis);
