import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createApp } from './createApp.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const isDev = process.env.NODE_ENV !== 'production';

const app = createApp();

const clientDist = path.join(__dirname, '../client/dist');
app.use(express.static(clientDist));

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path === '/health') return next();

  res.sendFile(path.join(clientDist, 'index.html'), (err) => {
    if (!err) return;

    if (isDev) {
      return res.status(503).type('html').send(`<!DOCTYPE html>
<html lang="ru"><head><meta charset="UTF-8"><title>Дневник питания</title></head>
<body style="font-family:sans-serif;max-width:520px;margin:40px auto;padding:0 16px;line-height:1.6">
<h1>Дневник питания</h1>
<p>Фронтенд в режиме разработки не отдаётся с порта <strong>${PORT}</strong>.</p>
<p>Запустите: <code>npm run dev</code></p>
<p>Откройте: <a href="http://localhost:5173/">http://localhost:5173/</a></p>
</body></html>`);
    }

    next(err);
  });
});

app.listen(PORT, () => {
  console.log(`[server] http://localhost:${PORT}`);
});
