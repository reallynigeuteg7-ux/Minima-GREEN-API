import { createHandler } from '../server/app.mjs';

const handler = createHandler();

export default function vercelHandler(req, res) {
  const url = new URL(req.url, 'https://localhost');
  const route = url.searchParams.get('route');
  if (route !== null) {
    url.searchParams.delete('route');
    req.url = `/api/${route}${url.search}`;
  }
  return handler(req, res);
}
