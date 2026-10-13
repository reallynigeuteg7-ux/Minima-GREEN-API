/** Small typed-by-contract GREEN-API WhatsApp client. Do not call from the browser. */
export function validateConnection({ apiUrl, idInstance, apiTokenInstance }) {
  if (typeof apiUrl !== 'string' || typeof idInstance !== 'string' || typeof apiTokenInstance !== 'string') {
    throw new ApiError(400, 'Введите URL API, ID инстанса и токен.');
  }
  let url;
  try { url = new URL(apiUrl.trim()); } catch { throw new ApiError(400, 'Укажите корректный адрес GREEN-API.'); }
  if (url.protocol !== 'https:' || !/^(?:[a-z0-9-]+\.)?api\.green-api\.com$/i.test(url.hostname)
      || url.username || url.password || url.port || url.pathname !== '/' || url.search || url.hash) {
    throw new ApiError(400, 'Разрешены только HTTPS-адреса вида https://7201.api.green-api.com.');
  }
  if (!/^\d{5,14}$/.test(idInstance)) throw new ApiError(400, 'ID инстанса должен содержать цифры.');
  if (!/^[a-zA-Z0-9_-]{10,256}$/.test(apiTokenInstance)) throw new ApiError(400, 'Проверьте API-токен инстанса.');
  return { apiUrl: url.origin, idInstance, apiTokenInstance };
}

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function isPhone(input) {
  return typeof input === 'string' && /^[1-9]\d{10,15}$/.test(input);
}

export function isChatId(input) {
  return typeof input === 'string' && (
    /^[1-9]\d{10,15}@c\.us$/.test(input)
    || /^[1-9]\d{0,19}@lid$/.test(input)
    || /^[1-9]\d{0,30}(?:-\d{1,20})?@g\.us$/.test(input)
  );
}

export function normalizeChats(data) {
  if (!Array.isArray(data)) return [];
  const chats = new Map();
  for (const chat of data) {
    const legacyId = String(chat?.id || '');
    const id = isChatId(chat?.newChatId) ? chat.newChatId : legacyId;
    if (!isChatId(id)) continue;
    chats.set(id, { id, name: chat.name || `Чат ${id}`, phone: legacyId.endsWith('@c.us') ? legacyId.slice(0, -5) : '' });
  }
  return [...chats.values()];
}

export function normalizeHistory(data) {
  if (!Array.isArray(data)) return [];
  return data
    .filter((m) => m && (m.typeMessage === 'textMessage' || m.typeMessage === 'extendedTextMessage')
      && typeof (m.textMessage ?? m.extendedTextMessage?.text) === 'string')
    .map((m) => ({
      id: String(m.idMessage ?? `${m.timestamp}-${m.textMessage}`),
      chatId: String(m.chatId || ''),
      text: m.textMessage ?? m.extendedTextMessage.text,
      direction: m.type === 'outgoing' ? 'outgoing' : 'incoming',
      timestamp: Number(m.timestamp) || Math.floor(Date.now() / 1000),
      status: m.statusMessage || undefined,
      senderName: m.senderName || '',
    }))
    .sort((a, b) => a.timestamp - b.timestamp);
}

export function normalizeNotification(envelope) {
  const body = envelope?.body;
  if (!body || typeof body !== 'object') return null;
  if (body.typeWebhook === 'outgoingMessageStatus') {
    return {
      kind: 'status',
      id: String(body.idMessage || ''),
      status: body.status || body.statusMessage || '',
    };
  }
  if (!['incomingMessageReceived', 'outgoingMessageReceived', 'outgoingAPIMessageReceived'].includes(body.typeWebhook)) return null;
  const data = body.messageData;
  if (!data || !['textMessage', 'extendedTextMessage'].includes(data.typeMessage)) return null;
  const text = data.textMessageData?.textMessage ?? data.extendedTextMessageData?.text;
  const chatId = body.senderData?.chatId ?? body.senderData?.sender;
  if (!chatId || typeof text !== 'string') return null;
  return {
    kind: 'message',
    id: String(body.idMessage || `${body.timestamp}-${text}`),
    chatId: String(chatId),
    text,
    direction: body.typeWebhook === 'incomingMessageReceived' ? 'incoming' : 'outgoing',
    timestamp: Number(body.timestamp) || Math.floor(Date.now() / 1000),
    senderName: body.senderData?.senderName || body.senderData?.chatName || '',
  };
}

export async function greenRequest(connection, methodName, { method = 'GET', body, receiptId, timeout = 12000 } = {}, fetchImpl = fetch) {
  const path = `/waInstance${connection.idInstance}/${methodName}/${connection.apiTokenInstance}${receiptId === undefined ? '' : `/${receiptId}`}`;
  const url = new URL(path, connection.apiUrl);
  if (methodName === 'receiveNotification') url.searchParams.set('receiveTimeout', '5');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  let response;
  try {
    response = await fetchImpl(url, {
      method,
      headers: { Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (error) {
    if (error?.name === 'AbortError' || ['ETIMEDOUT', 'UND_ERR_CONNECT_TIMEOUT'].includes(error?.cause?.code)) throw new ApiError(504, 'Сервер WhatsApp GREEN-API не отвечает. Проверьте доступность инстанса в кабинете и повторите подключение.');
    throw new ApiError(502, 'Не удалось связаться с GREEN-API. Проверьте адрес и сеть.');
  } finally {
    clearTimeout(timer);
  }
  const raw = await response.text();
  let data;
  try { data = raw ? JSON.parse(raw) : null; } catch { data = null; }
  if (!response.ok) {
    const upstream = typeof data?.message === 'string' ? data.message : typeof data?.error === 'string' ? data.error : '';
    const safe = upstream.replaceAll(connection.apiTokenInstance, '[скрыт]').slice(0, 180);
    throw new ApiError(response.status >= 500 ? 502 : response.status, safe || `GREEN-API вернул HTTP ${response.status}.`);
  }
  return data;
}
