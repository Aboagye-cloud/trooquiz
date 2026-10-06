// Minimal Supabase REST helper (no libraries needed for the guest pages)
const API = {
  headers() {
    return {
      apikey: SUPABASE_ANON_KEY,
      'Content-Type': 'application/json'
    };
  },

  async request(url, options) {
    const res = await fetch(url, options);
    if (!res.ok) {
      let detail = '';
      try { detail = (await res.json()).message || ''; } catch (e) { /* ignore */ }
      throw new Error(detail || 'Request failed (' + res.status + ')');
    }
    return res.json();
  },

  // Read rows from a table, e.g. API.get('levels?select=*&order=name')
  get(path) {
    return this.request(SUPABASE_URL + '/rest/v1/' + path, { headers: this.headers() });
  },

  // Call a database function, e.g. API.rpc('submit_quiz', { ... })
  rpc(name, body) {
    return this.request(SUPABASE_URL + '/rest/v1/rpc/' + name, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(body)
    });
  }
};