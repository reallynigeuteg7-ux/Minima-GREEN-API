import { createApp } from './app.mjs';

const port = Number(process.env.PORT || 3001);
const server = createApp({ serveStatic: (process.env.NODE_ENV === 'production' || process.argv.includes('--production')) });
server.listen(port, '0.0.0.0', () => {
  console.log(`WhatsApp API server: http://localhost:${port}`);
  if ((process.env.NODE_ENV === 'production' || process.argv.includes('--production'))) console.log(`React application: http://localhost:${port}`);
});
