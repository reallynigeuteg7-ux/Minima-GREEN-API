import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { createApp, createHandler } from '../server/app.mjs';
import { createSessionCodec } from '../server/session.mjs';

const credentials = { apiUrl: 'https://7201.api.green-api.com', idInstance: '720100000001', apiTokenInstance: 'a'.repeat(64) };
const secret = 'test-session-key-that-is-longer-than-32-characters';
const settings = { typeInstance: 'whatsapp', incomingWebhook: 'yes', outgoingMessageWebhook: 'yes', outgoingAPIMessageWebhook: 'yes', outgoingWebhook: 'yes' };

async function start(app, ctx) {
  await new Promise(resolve => app.listen(0, '127.0.0.1', resolve));
  ctx.after(() => app.close());
  return `http://127.0.0.1:${app.address().port}`;
}

test('encrypted session survives cold starts and QR authorization across separate functions', async ctx => {
  let state = 'notAuthorized';
  const fakeFetch = async url => new Response(JSON.stringify({
    getSettings: settings,
    getStateInstance: { stateInstance: state },
    getChats: [{ id: '79991234567@c.us', name: 'Контакт' }],
  }[url.pathname.split('/')[2]]), { status: 200 });
  const urls = [];
  for (let i = 0; i < 3; i++) urls.push(await start(createApp({ fetchImpl: fakeFetch, sessionSecret: secret }), ctx));
  const connected = await fetch(urls[0] + '/api/session', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-forwarded-proto': 'https' }, body: JSON.stringify(credentials) });
  assert.equal((await connected.json()).pending, true);
  const setCookie = connected.headers.get('set-cookie');
  assert.ok(setCookie.includes('HttpOnly') && setCookie.includes('Secure') && setCookie.includes('SameSite=Lax'));
  assert.equal(setCookie.includes(credentials.apiTokenInstance), false);
  state = 'authorized';
  const authorized = await fetch(urls[1] + '/api/session', { headers: { cookie: setCookie.split(';')[0] } });
  assert.equal((await authorized.json()).connected, true);
  const cookie = authorized.headers.get('set-cookie').split(';')[0];
  const chats = await fetch(urls[2] + '/api/chats', { headers: { cookie } });
  assert.equal(chats.status, 200);
  assert.equal((await chats.json()).chats[0].name, 'Контакт');
  const tampered = cookie.slice(0, 40) + (cookie[40] === 'A' ? 'B' : 'A') + cookie.slice(41);
  assert.equal((await fetch(urls[2] + '/api/chats', { headers: { cookie: tampered } })).status, 401);
});

test('session rejects expired cookies and cookies signed with a different key', () => {
  const codec = createSessionCodec(secret);
  const session = { sid: randomBytes(32).toString('hex'), connection: credentials, expires: Date.now() + 60000, state: 'authorized', ready: true };
  const cookie = codec.encode(session);
  assert.equal(createSessionCodec('another-secret-key-with-more-than-32-characters').decode(cookie), null);
  assert.equal(codec.decode(codec.encode({ ...session, expires: Date.now() - 1000 })), null);
  assert.throws(() => createSessionCodec('short'));
});

test('Vercel pre-parsed request bodies are accepted without reading a drained stream', async ctx => {
  const fakeFetch = async url => new Response(JSON.stringify(url.pathname.includes('/getSettings/') ? settings : { stateInstance: 'authorized' }), { status: 200 });
  const handler = createHandler({ fetchImpl: fakeFetch, sessionSecret: secret });
  const base = await start(createServer((req, res) => { req.body = credentials; return handler(req, res); }), ctx);
  const response = await fetch(base + '/api/session', { method: 'POST' });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).connected, true);
});

test('Vercel rewrite adapter dispatches nested API paths', async ctx => {
  const { default: handler } = await import('../api/index.mjs');
  const base = await start(createServer(handler), ctx);
  const health = await fetch(base + '/api/index?route=health');
  assert.deepEqual(await health.json(), { ok: true });
  assert.equal((await fetch(base + '/api/index?route=chats%2Fresolve', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status, 401);
});
