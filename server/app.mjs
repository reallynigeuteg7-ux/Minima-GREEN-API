import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ApiError, validateConnection, greenRequest, normalizeHistory, normalizeNotification, normalizeChats, isPhone, isChatId } from './green-api.mjs';

const DEFAULT_DIST = fileURLToPath(new URL('../dist/', import.meta.url));
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.webp': 'image/webp' };

function json(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(JSON.stringify(data));
}

async function parseBody(req) {
  let text = '';
  for await (const chunk of req) {
    text += chunk.toString('utf8');
    if (text.length > 16384) throw new ApiError(413, 'Слишком большой запрос.');
  }
  try { return text ? JSON.parse(text) : {}; } catch { throw new ApiError(400, 'Некорректный JSON.'); }
}

async function staticPage(res, pathname, distDir) {
  const filename = pathname === '/' ? 'index.html' : decodeURIComponent(pathname).replace(/^\/+/, '');
  const fullpath = resolve(distDir, filename);
  if (!(fullpath === distDir || fullpath.startsWith(distDir + sep))) throw new ApiError(404, 'Не найдено.');
  let target = fullpath;
  try {
    if (!(await stat(target)).isFile()) throw new Error('not a file');
  } catch {
    if (extname(filename)) throw new ApiError(404, 'Не найдено.');
    target = resolve(distDir, 'index.html');
  }
  const content = await readFile(target);
  res.writeHead(200, { 'Content-Type': MIME[extname(target)] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff' });
  res.end(content);
}

export function createApp({ fetchImpl = fetch, distDir = DEFAULT_DIST, serveStatic = false } = {}) {
  const sessions = new Map(); // Credentials live only in server RAM (no DB, no localStorage).

  function validateMessenger(settings) {
    if (settings?.typeInstance && settings.typeInstance !== 'whatsapp') {
      throw new ApiError(400, 'Нужен инстанс WhatsApp GREEN-API.');
    }
  }

  async function prepareSession(session, settings) {
    settings ??= await greenRequest(session.connection, 'getSettings', {}, fetchImpl);
    validateMessenger(settings);
    if (settings?.webhookUrl) {
      throw new ApiError(409, 'На инстансе задан Webhook URL. Очистите его в кабинете для получения сообщений в приложении.');
    }
    const desired = { incomingWebhook: 'yes', outgoingMessageWebhook: 'yes', outgoingAPIMessageWebhook: 'yes', outgoingWebhook: 'yes' };
    if (Object.entries(desired).some(([key, value]) => settings?.[key] !== value)) {
      await greenRequest(session.connection, 'setSettings', { method: 'POST', body: desired }, fetchImpl);
    }
    session.ready = true;
  }

  function currentSession(req) {
    const cookie = (req.headers.cookie || '').split(';').map(s => s.trim()).find(s => s.startsWith('minima_sid='));
    const sid = cookie?.slice('minima_sid='.length);
    const session = sid && sessions.get(sid);
    if (!session) return null;
    if (session.expires <= Date.now()) { sessions.delete(sid); return null; }
    return { sid, session };
  }

  async function handle(req, res) {
    const parsed = new URL(req.url || '/', 'http://localhost');
    const path = parsed.pathname;
    if (path === '/api/health' && req.method === 'GET') return json(res, 200, { ok: true });
    if (!path.startsWith('/api/')) {
      if (!serveStatic) throw new ApiError(404, 'Не найдено.');
      return staticPage(res, path, resolve(distDir));
    }
    if (path === '/api/session' && req.method === 'GET') {
      const auth = currentSession(req);
      if (!auth) return json(res, 200, { connected: false, idInstance: null });
      if (auth.session.state !== 'authorized') {
        const state = await greenRequest(auth.session.connection, 'getStateInstance', {}, fetchImpl);
        auth.session.state = state?.stateInstance || 'unknown';
      }
      if (auth.session.state === 'authorized' && !auth.session.ready) await prepareSession(auth.session);
      return json(res, 200, { connected: auth.session.state === 'authorized', pending: auth.session.state !== 'authorized', stateInstance: auth.session.state, idInstance: auth.session.connection.idInstance });
    }
    if (path === '/api/session' && req.method === 'POST') {
      const input = await parseBody(req);
      const connection = validateConnection(input);
      const settings = await greenRequest(connection, 'getSettings', {}, fetchImpl);
      validateMessenger(settings);
      const state = await greenRequest(connection, 'getStateInstance', {}, fetchImpl);
      const session = { connection, state: state?.stateInstance || 'unknown', expires: Date.now() + 12 * 60 * 60 * 1000, polling: false, ready: false };
      if (session.state === 'authorized') await prepareSession(session, settings);
      const old = currentSession(req);
      if (old) sessions.delete(old.sid);
      const sid = randomBytes(32).toString('hex');
      sessions.set(sid, session);
      const secure = !!req.socket.encrypted || req.headers['x-forwarded-proto'] === 'https';
      res.setHeader('Set-Cookie', `minima_sid=${sid}; HttpOnly; SameSite=Lax; Path=/; Max-Age=43200${secure ? '; Secure' : ''}`);
      return json(res, 200, { connected: session.state === 'authorized', pending: session.state !== 'authorized', stateInstance: session.state, idInstance: connection.idInstance });
    }
    if (path === '/api/logout' && req.method === 'POST') {
      const auth = currentSession(req);
      if (auth) sessions.delete(auth.sid);
      res.setHeader('Set-Cookie', 'minima_sid=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0');
      return json(res, 200, { connected: false });
    }
    const auth = currentSession(req);
    if (!auth) throw new ApiError(401, 'Сессия истекла. Подключитесь повторно.');
    const { connection } = auth.session;

    if (path === '/api/auth/qr' && req.method === 'GET') {
      const result = await greenRequest(connection, 'qr', {}, fetchImpl);
      return json(res, 200, result);
    }
    if (auth.session.state !== 'authorized') throw new ApiError(409, 'Завершите вход в WhatsApp по QR-коду.');

    if (path === '/api/chats' && req.method === 'GET') {
      const result = await greenRequest(connection, 'getChats', {}, fetchImpl);
      return json(res, 200, { chats: normalizeChats(result) });
    }

    if (path === '/api/chats/resolve' && req.method === 'POST') {
      const { phone, chatId } = await parseBody(req);
      if (chatId !== undefined) {
        if (!isChatId(chatId)) throw new ApiError(400, 'Некорректный chatId.');
        return json(res, 200, { chatId, exists: true });
      }
      if (!isPhone(phone)) throw new ApiError(400, 'Введите международный номер WhatsApp с кодом страны (11–16 цифр).');
      const phoneId = `${phone}@c.us`;
      const result = await greenRequest(connection, 'checkWhatsapp', { method: 'POST', body: { chatId: phoneId } }, fetchImpl);
      if (!result?.existsWhatsapp) throw new ApiError(404, 'На этом номере нет аккаунта WhatsApp.');
      const resolvedId = typeof result.chatId === 'string' && result.chatId ? result.chatId : phoneId;
      if (!isChatId(resolvedId)) throw new ApiError(502, 'GREEN-API вернул некорректный идентификатор чата.');
      return json(res, 200, { chatId: resolvedId, exists: true });
    }
    if (path.startsWith('/api/chats/') && path.endsWith('/messages') && req.method === 'GET') {
      const chatId = decodeURIComponent(path.slice('/api/chats/'.length, -'/messages'.length));
      if (!isChatId(chatId)) throw new ApiError(400, 'Некорректный chatId.');
      const result = await greenRequest(connection, 'getChatHistory', { method: 'POST', body: { chatId, count: 100 } }, fetchImpl);
      return json(res, 200, { messages: normalizeHistory(result) });
    }
    if (path === '/api/messages' && req.method === 'POST') {
      const { chatId, text } = await parseBody(req);
      if (!isChatId(chatId)) throw new ApiError(400, 'Некорректный chatId.');
      if (typeof text !== 'string' || !text.trim() || text.length > 4000) throw new ApiError(400, 'Введите сообщение длиной от 1 до 4000 символов.');
      const result = await greenRequest(connection, 'sendMessage', { method: 'POST', body: { chatId, message: text.trim() } }, fetchImpl);
      if (!result?.idMessage) throw new ApiError(502, 'GREEN-API не вернул ID сообщения.');
      return json(res, 200, { id: String(result.idMessage), queued: true });
    }
    if (path === '/api/updates' && req.method === 'GET') {
      if (auth.session.polling) return json(res, 200, { updates: [] });
      auth.session.polling = true;
      try {
        const envelope = await greenRequest(connection, 'receiveNotification', {}, fetchImpl);
        if (!envelope || envelope.receiptId === undefined) return json(res, 200, { updates: [] });
        const update = normalizeNotification(envelope);
        await greenRequest(connection, 'deleteNotification', { method: 'DELETE', receiptId: envelope.receiptId }, fetchImpl);
        return json(res, 200, { updates: update ? [update] : [] });
      } finally {
        auth.session.polling = false;
      }
    }
    throw new ApiError(404, 'Маршрут не найден.');
  }

  return createServer((req, res) => {
    handle(req, res).catch(error => {
      if (res.headersSent) return res.end();
      const status = error instanceof ApiError ? error.status : 500;
      if (!(error instanceof ApiError)) console.error('[Server error]', error);
      json(res, status, { error: error instanceof ApiError ? error.message : 'Внутренняя ошибка сервера.' });
    });
  });
}
