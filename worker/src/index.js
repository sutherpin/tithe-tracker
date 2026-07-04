// Cash Account Tracker API — Cloudflare Worker + D1
//
// Endpoints:
//   GET    /api/transactions        -> list all transactions (ordered by date, then id)
//   POST   /api/transactions        -> add a transaction { date, reason, amount, type }
//   DELETE /api/transactions/:id    -> delete a single transaction (used for "undo last")
//   DELETE /api/transactions        -> delete ALL transactions (used for "clear all")
//
// Auth: every request must include header  Authorization: Bearer <APP_SECRET>
// APP_SECRET is set via `wrangler secret put APP_SECRET` — never hardcode it here.
//
// CORS: only requests from ALLOWED_ORIGIN (set in wrangler.toml) are allowed.

function corsHeaders(env) {
  return {
    'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

function json(data, status, env) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(env) },
  });
}

function isAuthorized(request, env) {
  const auth = request.headers.get('Authorization') || '';
  const expected = `Bearer ${env.APP_SECRET}`;
  return auth === expected;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders(env) });
    }

    if (!url.pathname.startsWith('/api/transactions')) {
      return json({ error: 'Not found' }, 404, env);
    }

    if (!isAuthorized(request, env)) {
      return json({ error: 'Unauthorized' }, 401, env);
    }

    try {
      // GET /api/transactions
      if (request.method === 'GET') {
        const { results } = await env.DB.prepare(
          'SELECT id, date, reason, amount, type FROM transactions ORDER BY date ASC, id ASC'
        ).all();
        return json(results, 200, env);
      }

      // POST /api/transactions
      if (request.method === 'POST') {
        const body = await request.json();
        const { date, reason, amount, type } = body;

        if (!date || !reason || amount === undefined || !['deposit', 'withdrawal'].includes(type)) {
          return json({ error: 'Missing or invalid fields' }, 400, env);
        }

        const result = await env.DB.prepare(
          'INSERT INTO transactions (date, reason, amount, type) VALUES (?, ?, ?, ?)'
        ).bind(date, reason, parseFloat(amount), type).run();

        return json({ id: result.meta.last_row_id, date, reason, amount: parseFloat(amount), type }, 201, env);
      }

      // DELETE /api/transactions/:id  or  DELETE /api/transactions (clear all)
      if (request.method === 'DELETE') {
        const parts = url.pathname.split('/').filter(Boolean); // ['api','transactions', maybe id]

        if (parts.length === 2) {
          // Clear all
          await env.DB.prepare('DELETE FROM transactions').run();
          return json({ cleared: true }, 200, env);
        }

        if (parts.length === 3) {
          const id = parseInt(parts[2], 10);
          if (isNaN(id)) return json({ error: 'Invalid id' }, 400, env);
          await env.DB.prepare('DELETE FROM transactions WHERE id = ?').bind(id).run();
          return json({ deleted: id }, 200, env);
        }

        return json({ error: 'Invalid path' }, 400, env);
      }

      return json({ error: 'Method not allowed' }, 405, env);
    } catch (err) {
      return json({ error: err.message }, 500, env);
    }
  },
};
