import { Router } from 'express';
import { authMiddleware } from './auth.js';
import * as controller from './controller.js';
import { processWebhookUpdate } from './telegram.js';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'dnevnik-pitaniya' });
});

router.post('/telegram/webhook', async (req, res) => {
  await processWebhookUpdate(req.body);
  res.sendStatus(200);
});

const api = Router();

// Справочник и шкалы — без авторизации (можно читать программу)
api.get('/food-groups', controller.getFoodGroups);
api.get('/guide', controller.getGuide);
api.get('/bot-status', controller.getBotStatus);

api.use(authMiddleware);

api.get('/portions/today', controller.getPortionsToday);
api.get('/meals', controller.getMealsHandler);
api.post('/meals', controller.createMeal);
api.get('/recommendations', controller.getRecommendations);
api.post('/meals/recognize', controller.recognizeMealFromPhoto);
api.get('/challenges', controller.getChallengesHandler);
api.post('/challenges/join', controller.joinChallenge);
api.get('/challenges/mine', controller.getMyChallenges);
api.post('/reminders', controller.setReminderHandler);

router.use('/api', api);

export default router;
