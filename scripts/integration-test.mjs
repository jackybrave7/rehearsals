/**
 * Integration tests with optional login via env:
 *   SMOKE_EMAIL=... SMOKE_PASSWORD=... node scripts/integration-test.mjs
 */
const API = process.env.API_BASE ?? 'http://127.0.0.1:3001';
const WEB = process.env.WEB_BASE ?? 'http://127.0.0.1:3003';

const results = [];
let cookie = '';

function record(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

async function request(method, path, body) {
  const headers = { ...(cookie ? { Cookie: cookie } : {}) };
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    redirect: 'manual',
  });
  const setCookie = res.headers.getSetCookie?.() ?? [];
  for (const part of setCookie) {
    const piece = part.split(';')[0];
    if (piece.startsWith('rehearsals_session=')) {
      cookie = piece;
    }
  }
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: res.status, json };
}

async function testPublicWebRoutes() {
  const routes = ['/', '/pricing', '/login', '/legal/terms', '/legal/privacy', '/legal/offer'];
  for (const route of routes) {
    try {
      const res = await fetch(`${WEB}${route}`, { redirect: 'manual' });
      record(`WEB GET ${route}`, res.status === 200, `status ${res.status}`);
    } catch (e) {
      record(`WEB GET ${route}`, false, String(e));
    }
  }
}

async function testLogin() {
  const email = process.env.SMOKE_EMAIL?.trim();
  const password = process.env.SMOKE_PASSWORD ?? '';
  if (!email || !password) {
    record('AUTH login (skipped)', true, 'set SMOKE_EMAIL and SMOKE_PASSWORD to enable');
    return false;
  }

  const login = await request('POST', '/api/auth/login', { email, password });
  const ok = login.status === 200 && login.json?.user?.email;
  record('AUTH POST /api/auth/login', ok, ok ? login.json.user.email : `status ${login.status}`);
  return ok;
}

async function testAuthenticatedApi() {
  const me = await request('GET', '/api/auth/me');
  record('AUTH GET /api/auth/me', me.status === 200 && me.json?.user, `role theaters: ${me.json?.theaters?.length ?? 0}`);

  const state = await request('GET', '/api/state');
  const s = state.json;
  const stateOk =
    state.status === 200 &&
    s &&
    Array.isArray(s.theaters) &&
    Array.isArray(s.rehearsals) &&
    Array.isArray(s.actors) &&
    Array.isArray(s.scenes);
  record(
    'DATA GET /api/state shape',
    stateOk,
    stateOk
      ? `theaters=${s.theaters.length} plays=${s.plays?.length ?? 0} rehearsals=${s.rehearsals.length}`
      : `status ${state.status}`
  );

  const theaterId = s?.activeTheaterId ?? s?.theaters?.[0]?.id;
  if (theaterId) {
    const actorMe = await request('GET', `/api/actor/me?theaterId=${encodeURIComponent(theaterId)}`);
    record('ACTOR GET /api/actor/me', actorMe.status === 200, `linked=${Boolean(actorMe.json?.linked)}`);

    const rsvpList = await request(
      'GET',
      `/api/actor/me/rehearsals-rsvp?theaterId=${encodeURIComponent(theaterId)}`
    );
    record(
      'ACTOR GET /api/actor/me/rehearsals-rsvp',
      rsvpList.status === 200 && Array.isArray(rsvpList.json?.rehearsals),
      `count=${rsvpList.json?.rehearsals?.length ?? 0}`
    );

    const notes = await request('GET', `/api/actor/me/notes?theaterId=${encodeURIComponent(theaterId)}`);
    record(
      'ACTOR GET /api/actor/me/notes',
      notes.status === 200 && Array.isArray(notes.json?.notes),
      `count=${notes.json?.notes?.length ?? 0}`
    );
  } else {
    record('ACTOR endpoints (skipped)', true, 'no theater in state');
  }

  const rehearsalId = s?.rehearsals?.[0]?.id;
  if (rehearsalId) {
    const rsvp = await request('GET', `/api/rehearsals/${encodeURIComponent(rehearsalId)}/rsvp`);
    record(
      'REHEARSAL GET /api/rehearsals/:id/rsvp',
      rsvp.status === 200 && typeof rsvp.json?.rsvp === 'object',
      `keys=${Object.keys(rsvp.json?.rsvp ?? {}).length}`
    );
  } else {
    record('REHEARSAL rsvp (skipped)', true, 'no rehearsals');
  }

  const telegram = await request('GET', `/api/telegram/config${theaterId ? `?theaterId=${theaterId}` : ''}`);
  record('TELEGRAM GET /api/telegram/config', telegram.status === 200, `configured=${telegram.json?.configured}`);
}

async function main() {
  console.log(`\nIntegration tests\nAPI: ${API}\nWEB: ${WEB}\n`);
  await testPublicWebRoutes();
  const loggedIn = await testLogin();
  if (loggedIn) {
    await testAuthenticatedApi();
  }

  const failed = results.filter((r) => !r.ok).length;
  const passed = results.filter((r) => r.ok).length;
  console.log(`\n${passed} passed, ${failed} failed, ${results.length} total\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
