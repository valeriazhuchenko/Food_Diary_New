import express from 'express';
import cors from 'cors';
import router from './routes.js';
import { initFirebase } from './firebase.js';
import { initTelegram } from './telegram.js';
import { startReminderScheduler } from './reminderScheduler.js';

let bootstrapped = false;

function bootstrap() {
  if (bootstrapped) return;
  initFirebase();

  const onVercel = process.env.VERCEL === '1';
  initTelegram({ serverless: onVercel });

  if (!onVercel) {
    startReminderScheduler();
  }

  bootstrapped = true;
}

export function createApp() {
  bootstrap();

  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '10mb' }));
  app.use(router);

  return app;
}
