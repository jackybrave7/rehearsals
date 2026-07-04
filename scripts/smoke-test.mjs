/**
 * API smoke tests — no credentials required for public/unauth checks.
 * Run: node scripts/smoke-test.mjs
 */
const API = process.env.API_BASE ?? 'http://127.0.0.1:3001';

const results = [];

function record(name, ok, detail = '') {
  results.push({ name, ok, detail });
  const mark = ok ? 'PASS' : 'FAIL';
  console.log(`${mark}  ${name}${detail ? ` — ${detail}` : ''}`);
}

async function get(path) {
  const res = await fetch(`${API}${path}`, { credentials: 'include' });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: res.status, json, headers: res.headers };
}

async function post(path, body) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: res.status, json };
}

async function main() {
  console.log(`\nAPI smoke tests → ${API}\n`);

  try {
    const health = await get('/api/health');
    record('GET /api/health', health.status === 200 && health.json?.ok === true);
  } catch (e) {
    record('GET /api/health', false, String(e));
  }

  try {
    const config = await get('/api/auth/config');
    record('GET /api/auth/config', config.status === 200);
  } catch (e) {
    record('GET /api/auth/config', false, String(e));
  }

  try {
    const me = await get('/api/auth/me');
    record('GET /api/auth/me (no session)', me.status === 401 || me.json?.user == null, `status ${me.status}`);
  } catch (e) {
    record('GET /api/auth/me', false, String(e));
  }

  try {
    const state = await get('/api/state');
    record(
      'GET /api/state (no session)',
      state.status === 401 || state.status === 403,
      `status ${state.status}`
    );
  } catch (e) {
    record('GET /api/state', false, String(e));
  }

  try {
    const login = await post('/api/auth/login', { email: '', password: '' });
    record('POST /api/auth/login invalid body', login.status === 400 || login.status === 401);
  } catch (e) {
    record('POST /api/auth/login', false, String(e));
  }

  try {
    const actorMe = await get('/api/actor/me');
    record('GET /api/actor/me (no session)', actorMe.status === 401, `status ${actorMe.status}`);
  } catch (e) {
    record('GET /api/actor/me', false, String(e));
  }

  try {
    const rsvp = await get('/api/rehearsals/test-id/rsvp');
    record(
      'GET /api/rehearsals/:id/rsvp (no session)',
      rsvp.status === 401,
      `status ${rsvp.status}`
    );
  } catch (e) {
    record('GET /api/rehearsals/:id/rsvp', false, String(e));
  }

  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${passed} passed, ${failed} failed, ${results.length} total\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
