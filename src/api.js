export async function api(endpoint, { method = 'GET', body, signal } = {}) {
  let response;
  try {
    response = await fetch(`/api${endpoint}`, {
      method,
      credentials: 'same-origin',
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new Error('Сервер недоступен. Проверьте, что API запущен.');
  }
  let json;
  try { json = await response.json(); } catch { throw new Error('Сервер вернул некорректный ответ.'); }
  if (!response.ok) {
    const error = new Error(json.error || `Ошибка ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return json;
}
