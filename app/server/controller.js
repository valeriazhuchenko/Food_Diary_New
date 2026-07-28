import { FieldValue } from 'firebase-admin/firestore';
import { getDb, memory } from './firebase.js';
import {
  HUNGER_SCALE,
  SATIETY_SCALE,
  FOOD_GROUPS,
  PLATE_METHOD,
  GUIDE_SECTIONS,
  PORTION_KEYS,
  getMeals,
  getTodayStats,
  buildRecommendations,
  createMeal as saveMeal,
  getChallenges,
  setReminder,
  normalizePortions,
  clampHunger,
  clampSatiety,
} from './services/data.js';
import {
  PALM_MEASURES,
  EATING_RULES,
  SWEETS_RULE,
  HYDRATION_RULE,
} from './services/nutritionProgram.js';

function userId(req) {
  return String(req.telegramUser.id);
}

export const PORTION_LABELS = {
  grains: 'Крупы / макароны (горсть)',
  grains_bread: 'Хлеб (1 ломтик)',
  protein_main: 'Мясо / рыба / бобовые',
  protein_egg: 'Яйцо',
  protein_nuts: 'Орехи (30 г)',
  produce_fist: 'Овощи / фрукты (кулак)',
  produce_greens: 'Зелень (2 горсти)',
  produce_starchy: 'Крахмалистые овощи',
  produce_dried: 'Сухофрукты (30 г)',
  produce_juice: 'Сок (200 мл)',
  oils: 'Масло (ч. л.)',
  dairy: 'Молочные',
  sweets: 'Сладости',
};

export function getBotStatus(_req, res) {
  const token = process.env.BOT_TOKEN?.trim();
  const tokenOk = Boolean(token && !token.includes('your_bot'));
  const webhookUrl =
    process.env.WEBHOOK_URL ||
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}/telegram/webhook`
      : null);

  res.json({
    tokenConfigured: tokenOk,
    webhookUrl,
    webappUrl: process.env.WEBAPP_URL || null,
    vercel: process.env.VERCEL === '1',
  });
}

export function getFoodGroups(_req, res) {
  res.json({
    groups: FOOD_GROUPS,
    portionKeys: PORTION_KEYS,
    portionLabels: PORTION_LABELS,
    hungerScale: HUNGER_SCALE,
    satietyScale: SATIETY_SCALE,
    plateMethod: PLATE_METHOD,
    palmMeasures: PALM_MEASURES,
    eatingRules: EATING_RULES,
    sweetsRule: SWEETS_RULE,
    hydrationRule: HYDRATION_RULE,
  });
}

export function getGuide(_req, res) {
  res.json({ sections: GUIDE_SECTIONS });
}

export async function getMealsHandler(req, res) {
  res.json({ meals: await getMeals(userId(req), 50) });
}

export async function getPortionsToday(req, res) {
  const stats = await getTodayStats(userId(req));
  res.json({
    portions: stats.portions,
    totals: stats.totals,
    avgHunger: stats.avgHunger,
    avgSatiety: stats.avgSatiety,
    mealsCount: stats.count,
    plateMeals: stats.plateMeals,
    sweetsToday: stats.sweetsToday,
  });
}

export async function createMeal(req, res) {
  const {
    name,
    mealType,
    hungerBefore,
    satietyAfter,
    portionMethod,
    usedPlateMethod,
    plateSectors,
    portions,
    drank,
    notes,
  } = req.body;

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({ error: 'name is required' });
  }

  const meal = await saveMeal(userId(req), {
    name,
    mealType,
    hungerBefore: clampHunger(hungerBefore),
    satietyAfter: clampSatiety(satietyAfter),
    portionMethod,
    usedPlateMethod,
    plateSectors,
    portions: normalizePortions(portions),
    drank,
    notes,
  });
  res.status(201).json(meal);
}

export async function getRecommendations(req, res) {
  const stats = await getTodayStats(userId(req));
  res.json({
    tips: buildRecommendations(stats),
    stats: {
      mealsLogged: stats.count,
      avgHunger: stats.avgHunger,
      avgSatiety: stats.avgSatiety,
      portions: stats.portions,
      plateMeals: stats.plateMeals,
      sweetsToday: stats.sweetsToday,
    },
  });
}

export async function getChallengesHandler(_req, res) {
  res.json({ challenges: await getChallenges() });
}

export async function joinChallenge(req, res) {
  const { challengeId } = req.body;
  if (!challengeId) {
    return res.status(400).json({ error: 'challengeId is required' });
  }

  const uid = userId(req);
  const db = getDb();
  if (db) {
    await db
      .collection('users')
      .doc(uid)
      .collection('challengeJoins')
      .doc(challengeId)
      .set({ joinedAt: new Date().toISOString() });
    await db
      .collection('challenges')
      .doc(challengeId)
      .set({ participants: FieldValue.increment(1) }, { merge: true })
      .catch(() => {});
  } else {
    memory.challenges.set(`${uid}:${challengeId}`, {
      joinedAt: new Date().toISOString(),
    });
  }

  res.json({ ok: true, challengeId });
}

export async function getMyChallenges(req, res) {
  const uid = userId(req);
  const db = getDb();

  if (db) {
    const snap = await db
      .collection('users')
      .doc(uid)
      .collection('challengeJoins')
      .get();
    return res.json({ joined: snap.docs.map((d) => d.id) });
  }

  const joined = [];
  for (const [key, val] of memory.challenges) {
    if (key.startsWith(`${uid}:`) && val) joined.push(key.split(':')[1]);
  }
  res.json({ joined });
}

export async function setReminderHandler(req, res) {
  const { hour, minute, enabled } = req.body;
  if (hour == null || minute == null) {
    return res.status(400).json({ error: 'hour and minute are required' });
  }
  res.json({ reminder: await setReminder(userId(req), hour, minute, enabled) });
}

export async function recognizeMealFromPhoto(req, res) {
  const { imageBase64 } = req.body;
  if (!imageBase64) {
    return res.status(400).json({ error: 'imageBase64 is required' });
  }

  res.json({
    suggestion: {
      name: 'Салат с курицей и киноа',
      usedPlateMethod: true,
      portions: {
        produce_fist: 2,
        protein_main: 1,
        grains: 1,
        oils: 1,
      },
      note: 'Демо-распознавание. Уточните порции и отметьте голод/насыщение.',
    },
  });
}
