import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server/app.mjs';
import { normalizeNotification, normalizeHistory, validateConnection, normalizeChats, isPhone, isChatId } from '../server/green-api.mjs';

const credentials = { apiUrl: 'https://7201.api.green-api.com', idInstance: '720100000001', apiTokenInstance: 'a'.repeat(64) };
const fixtureHistory = [
  { type: 'outgoing', typeMessage: 'textMessage', idMessage: 'msg2', chatId: '79991234567@c.us', textMessage: 'Привет!', timestamp: 200, statusMessage: 'sent' },
  { type: 'incoming', typeMessage: 'textMessage', idMessage: 'msg1', chatId: '79991234567@c.us', textMessage: 'Здравствуйте!', timestamp: 100 },
  { type: 'incoming', typeMessage: 'imageMessage', idMessage: 'img1', chatId: '79991234567@c.us', timestamp: 300 },
];

test('GREEN-API host must be HTTPS and a known host', () => {
  assert.equal(validateConnection(credentials).apiUrl, 'https://7201.api.green-api.com');
  assert.throws(() => validateConnection({ ...credentials, apiUrl: 'https://example.com' }));
  assert.throws(() => validateConnection({ ...credentials, apiUrl: 'http://7201.api.green-api.com' }));
});

test('history maps only texts and sorts oldest first', () => {
  const list = normalizeHistory(fixtureHistory);
  assert.equal(list.length, 2);
  assert.deepEqual(list.map(m => m.id), ['msg1', 'msg2']);
  assert.equal(list[1].direction, 'outgoing');
});

test('WhatsApp notification maps received text', () => {
  const msg = normalizeNotification({ body: { typeWebhook: 'incomingMessageReceived', idMessage: 'm3', timestamp: 300, senderData: { chatId: '79991234567@c.us', senderName: 'Александр' }, messageData: { typeMessage: 'textMessage', textMessageData: { textMessage: 'Спасибо!' } } } });
  assert.equal(msg.chatId, '79991234567@c.us');
  assert.equal(msg.text, 'Спасибо!');
  assert.equal(msg.direction, 'incoming');
});

test('end-to-end mock: connect → check recipient → history → send → receive → delete', async (ctx) => {
  const calls = [];
  const fakeFetch = async (url, options) => {
    const method = url.pathname.split('/')[2];
    calls.push({ method, httpMethod: options.method, body: options.body ? JSON.parse(options.body) : null });
    const responses = {
      getStateInstance: { stateInstance: 'authorized' },
      getSettings: { typeInstance: 'whatsapp', webhookUrl: '', incomingWebhook: 'no' },
      setSettings: { saveSettings: true },
      getChats: [{ id: '79991234567@c.us', newChatId: '123456789012345@lid', name: 'Александр', type: 'user' }, { id: '120363000000000000@g.us', name: 'Команда', type: 'group' }],
      checkWhatsapp: { existsWhatsapp: true, chatId: '79991234567@c.us' },
      getChatHistory: fixtureHistory,
      sendMessage: { idMessage: 'new123' },
      receiveNotification: { receiptId: 1234, body: { typeWebhook: 'incomingMessageReceived', idMessage: 'answer123', timestamp: 310, senderData: { chatId: '79991234567@c.us' }, messageData: { typeMessage: 'textMessage', textMessageData: { textMessage: 'Ответ получен' } } } },
      deleteNotification: { result: true },
    };
    return new Response(JSON.stringify(responses[method]), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  const app = createApp({ fetchImpl: fakeFetch });
  await new Promise(resolve => app.listen(0, '127.0.0.1', resolve));
  ctx.after(() => app.close());
  const base = `http://127.0.0.1:${app.address().port}`;
  const request = (path, { method = 'GET', body, cookie = '' } = {}) => fetch(base + path, { method, headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), cookie }, body: body ? JSON.stringify(body) : undefined });

  const noSession = await request('/api/messages', { method: 'POST', body: { chatId: '79991234567@c.us', text: 'x' } });
  assert.equal(noSession.status, 401);

  const connected = await request('/api/session', { method: 'POST', body: credentials });
  assert.equal(connected.status, 200);
  const cookie = connected.headers.get('set-cookie').split(';')[0];
  assert.ok(cookie.startsWith('minima_sid='));
  assert.equal(connected.headers.get('set-cookie').includes('HttpOnly'), true);
  assert.ok(calls.some(c => c.method === 'setSettings' && c.body.incomingWebhook === 'yes'));

  const chats = await request('/api/chats', { cookie });
  assert.deepEqual((await chats.json()).chats.map(c => c.id), ['123456789012345@lid', '120363000000000000@g.us']);

  const recipient = await request('/api/chats/resolve', { method: 'POST', cookie, body: { phone: '79991234567' } });
  assert.deepEqual(await recipient.json(), { chatId: '79991234567@c.us', exists: true });
  assert.deepEqual(calls.at(-1), { method: 'checkWhatsapp', httpMethod: 'POST', body: { chatId: '79991234567@c.us' } });

  const history = await request('/api/chats/79991234567@c.us/messages', { cookie });
  assert.deepEqual((await history.json()).messages.map(x => x.text), ['Здравствуйте!', 'Привет!']);

  const send = await request('/api/messages', { method: 'POST', cookie, body: { chatId: '79991234567@c.us', text: 'Тестовое сообщение' } });
  assert.deepEqual(await send.json(), { id: 'new123', queued: true });

  const updates = await request('/api/updates', { cookie });
  const received = await updates.json();
  assert.equal(received.updates[0].text, 'Ответ получен');
  assert.equal(calls.at(-1).method, 'deleteNotification');
  assert.equal(calls.at(-1).httpMethod, 'DELETE');

  const badNumber = await request('/api/chats/resolve', { method: 'POST', cookie, body: { phone: '77015555555' } });
  // WhatsApp supports international phone numbers, including Kazakhstan.
  assert.equal(badNumber.status, 200);

  const badMessage = await request('/api/messages', { method: 'POST', cookie, body: { chatId: '79991234567@c.us', text: '' } });
  assert.equal(badMessage.status, 400);

  const signout = await request('/api/logout', { method: 'POST', cookie });
  assert.equal(signout.status, 200);
  assert.equal((await request('/api/session', { cookie }).then(res => res.json())).connected, false);
});

test('WhatsApp recipients accept phone, LID and group chat IDs', () => {
  assert.ok(isPhone('447700900123'));
  assert.ok(isPhone('77015555555'));
  assert.ok(isChatId('79991234567@c.us'));
  assert.ok(isChatId('123456789012345@lid'));
  assert.ok(isChatId('79991234567-1479621234@g.us'));
  assert.ok(isChatId('120363000000000000@g.us'));
  assert.equal(isPhone('123'), false);
  assert.equal(isChatId('-1001234567890'), false);
  assert.equal(isChatId('@example_user'), false);
});

test('WhatsApp chat list uses id and prefers newChatId without duplicates', () => {
  const chats = normalizeChats([
    { id: '79991234567@c.us', newChatId: '123456789012345@lid', name: 'Александр' },
    { id: '123456789012345@lid', name: 'Александр' },
    { id: '120363000000000000@g.us', name: 'Команда' },
    { id: 'invalid' },
  ]);
  assert.deepEqual(chats.map(c => c.id), ['123456789012345@lid', '120363000000000000@g.us']);
});

test('pending session offers QR and blocks messaging until WhatsApp is authorized', async (ctx) => {
  let state = 'notAuthorized';
  const fakeFetch = async (url) => {
    const method = url.pathname.split('/')[2];
    const data = {
      getStateInstance: { stateInstance: state },
      qr: { type: 'qrCode', message: 'aGVsbG8=' },
      getSettings: { typeInstance: 'whatsapp', webhookUrl: '', incomingWebhook: 'yes', outgoingMessageWebhook: 'yes', outgoingAPIMessageWebhook: 'yes', outgoingWebhook: 'yes' },
    }[method];
    return new Response(JSON.stringify(data), { status: 200 });
  };
  const app = createApp({ fetchImpl: fakeFetch });
  await new Promise(resolve => app.listen(0, '127.0.0.1', resolve));
  ctx.after(() => app.close());
  const base = `http://127.0.0.1:${app.address().port}`;
  const response = await fetch(base + '/api/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(credentials) });
  const cookie = response.headers.get('set-cookie').split(';')[0];
  assert.equal((await response.json()).pending, true);
  const qr = await fetch(base + '/api/auth/qr', { headers: { cookie } });
  assert.equal((await qr.json()).type, 'qrCode');
  assert.equal((await fetch(base + '/api/chats', { headers: { cookie } })).status, 409);
  state = 'authorized';
  const authorized = await fetch(base + '/api/session', { headers: { cookie } });
  assert.equal((await authorized.json()).connected, true);
});

test('connection rejects a Telegram instance before starting WhatsApp authorization', async (ctx) => {
  const calls = [];
  const fakeFetch = async (url) => {
    calls.push(url.pathname.split('/')[2]);
    return new Response(JSON.stringify({ typeInstance: 'telegram' }), { status: 200 });
  };
  const app = createApp({ fetchImpl: fakeFetch });
  await new Promise(resolve => app.listen(0, '127.0.0.1', resolve));
  ctx.after(() => app.close());
  const response = await fetch(`http://127.0.0.1:${app.address().port}/api/session`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(credentials) });
  assert.equal(response.status, 400);
  assert.equal(response.headers.get('set-cookie'), null);
  assert.deepEqual(calls, ['getSettings']);
});
