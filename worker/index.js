const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_BODY = 256;
const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'Vary': 'Origin' };
function json(data, status = 200, origin = null) {
  return Response.json(data, { status, headers: { ...headers, ...(origin ? { 'Access-Control-Allow-Origin': origin } : {}) } });
}
async function limitedBody(request) {
  if (Number(request.headers.get('Content-Length')) > MAX_BODY) throw new Error('too_large');
  const reader = request.body?.getReader();
  if (!reader) throw new Error('bad_json');
  const chunks = []; let size = 0;
  while (true) {
    const { done, value } = await reader.read(); if (done) break;
    size += value.byteLength;
    if (size > MAX_BODY) { await reader.cancel(); throw new Error('too_large'); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { return JSON.parse(new TextDecoder().decode(bytes)); } catch { throw new Error('bad_json'); }
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    const origin = request.headers.get('Origin');
    const allowed = (env.ALLOWED_ORIGINS || '').split(',').filter(Boolean);
    allowed.push(url.origin); // Same-origin backend comparison page.
    if (origin && !allowed.includes(origin)) return json({ error: 'origin_not_allowed' }, 403);
    const cors = origin || null;
    if (request.method === 'OPTIONS') {
      if (!origin) return json({ error: 'origin_required' }, 403);
      const method = request.headers.get('Access-Control-Request-Method');
      const requested = (request.headers.get('Access-Control-Request-Headers') || '').toLowerCase().split(',').map(s => s.trim()).filter(Boolean);
      if (!['GET', 'POST'].includes(method) || requested.some(s => s !== 'content-type')) return json({ error: 'preflight_not_allowed' }, 403, cors);
      return new Response(null, { status: 204, headers: { ...headers, 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'GET, POST', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '600' } });
    }
    if (!['GET', 'POST'].includes(request.method)) return json({ error: 'method_not_allowed' }, 405, cors);
    // CF IP is used only as an in-memory platform rate-limit key, never stored in D1.
    if (!env.RATE_LIMITER) return json({ error: 'rate_limiter_not_configured' }, 503, cors);
    if (!(await env.RATE_LIMITER.limit({ key: request.headers.get('CF-Connecting-IP') || 'local' })).success) return json({ error: 'rate_limited' }, 429, cors);
    if (url.pathname === '/api/ping' && request.method === 'GET') {
      const nonce = url.searchParams.get('nonce');
      if (!UUID.test(nonce || '')) return json({ error: 'invalid_nonce' }, 400, cors);
      return json({ ok: true, nonce, serverTime: new Date().toISOString(), service: 'classroom-network-test' }, 200, cors);
    }
    if (!env.DB) return json({ error: 'database_not_configured' }, 503, cors);
    try {
      if (url.pathname === '/api/probes' && request.method === 'POST') {
        // Require an explicit allowed Origin for writes, including the direct test page.
        if (!origin) return json({ error: 'origin_required' }, 403);
        if ((request.headers.get('Content-Type') || '').split(';')[0] !== 'application/json') return json({ error: 'json_required' }, 415, cors);
        const body = await limitedBody(request);
        if (!body || typeof body !== 'object' || Object.keys(body).sort().join(',') !== 'id,marker' || !UUID.test(body.id || '') || !UUID.test(body.marker || '')) return json({ error: 'invalid_probe' }, 400, cors);
        await env.DB.prepare('INSERT INTO probes (id, marker, created_at) VALUES (?, ?, ?)').bind(body.id, body.marker, Date.now()).run();
        return json({ ok: true, id: body.id }, 201, cors);
      }
      const match = url.pathname.match(/^\/api\/probes\/([^/]+)$/);
      if (match && request.method === 'GET') {
        if (!UUID.test(match[1])) return json({ error: 'invalid_id' }, 400, cors);
        // Query D1 primary explicitly to ensure read-after-write consistency.
        const db = env.DB.withSession ? env.DB.withSession('first-primary') : env.DB;
        const probe = await db.prepare('SELECT id, marker, created_at FROM probes WHERE id = ? AND created_at > ?').bind(match[1], Date.now() - 86400000).first();
        return probe ? json({ ok: true, probe }, 200, cors) : json({ error: 'not_found' }, 404, cors);
      }
      return json({ error: 'not_found' }, 404, cors);
    } catch (error) {
      if (error.message === 'too_large') return json({ error: 'body_too_large' }, 413, cors);
      if (error.message === 'bad_json') return json({ error: 'invalid_json' }, 400, cors);
      if (error.message.includes('probe_budget_exhausted')) return json({ error: 'test_budget_exhausted' }, 429, cors);
      if (error.message.includes('UNIQUE constraint')) return json({ error: 'already_exists' }, 409, cors);
      return json({ error: 'database_unavailable' }, 503, cors);
    }
  }
};
