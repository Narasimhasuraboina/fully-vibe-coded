import express from 'express';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = Number(process.env.PORT) || 3001;
const homeserverOrigin = new URL(process.env.MATRIX_HOMESERVER_URL || 'https://matrix.org').origin;
const homeserverWebsocketOrigin = homeserverOrigin.replace(/^https:/, 'wss:').replace(/^http:/, 'ws:');

app.disable('x-powered-by');
app.use((req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('X-Frame-Options', 'DENY');
  res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (process.env.NODE_ENV === 'production') {
    if (req.secure) res.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    res.set('Content-Security-Policy', [
      "default-src 'self'",
      "script-src 'self' 'wasm-unsafe-eval'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      "img-src 'self' data: blob: https://images.unsplash.com",
      "media-src 'self' data: blob:",
      `connect-src 'self' ${homeserverOrigin} ${homeserverWebsocketOrigin}`,
      "worker-src 'self' blob:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '));
  }
  next();
});
app.set('trust proxy', process.env.TRUST_PROXY === '1');
app.get('/healthz', (_req, res) => res.status(200).send('OK'));

const distPath = path.resolve(__dirname, '../dist');
app.use(express.static(distPath, { index: false, maxAge: process.env.NODE_ENV === 'production' ? '1h' : 0 }));
app.get('*path', (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'API route not found.' });
  res.sendFile(path.join(distPath, 'index.html'), (error) => {
    if (error && !res.headersSent) res.status(503).send('Frontend build is missing. Run npm run build first.');
  });
});

http.createServer(app).listen(port, '0.0.0.0', () => {
  console.log(`[CHATFORGE WEB] Listening on port ${port}`);
  console.log(`[MATRIX HOMESERVER] ${homeserverOrigin}`);
});
