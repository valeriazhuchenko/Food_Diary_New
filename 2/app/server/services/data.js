import { FieldValue } from 'firebase-admin/firestore';
import { getDb, memory } from '../firebase.js';
import {
  HUNGER_SCALE,
  SATIETY_SCALE,
  PORTION_KEYS,
  FOOD_GROUPS,
  PLATE_METHOD,
  GUIDE_SECTIONS,
  DAILY_TIPS,
  SWEETS_RULE,
  IDEAL_HUNGER,
  IDEAL_SATIETY,
} from './nutritionProgram.js';

export {
  HUNGER_SCALE,
  SATIETY_SCALE,
  FOOD_GROUPS,
  PLATE_METHOD,
  GUIDE_SECTIONS,
  PORTION_KEYS,
};

export const HUNGER_LABELS = Object.fromEntries(
  HUNGER_SCALE.map((s) => [s.value, s.title])
);
export const SATIETY_LABELS = Object.fromEntries(
  SATIETY_SCALE.map((s) => [s.value, s.title])
);

export const DEFAULT_CHALLENGES = [
  {
    id: 'produce-5',
    title: '5+ порций овощей и фруктов',
    description: 'Достигайте минимума по программе каждый день.',
    participants: 0,
  },
  {
    id: 'plate-method',
    title: 'Метод тарелки',
    description: '1–2 приёма пищи в день по схеме ½–¼–¼.',
    participants: 0,
  },
  {
    id: 'mindful-scale',
    title: 'Шкала 0–4',
    description: '7 дней записывайте голод до и насыщение после еды.',
    participants: 0,
  },
];

function isToday(isoDate) {
  const d = new Date(isoDate);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

export function emptyPortions() {
  return Object.fromEntries(PORTION_KEYS.map((k) => [k, 0]));
}

export function normalizePortions(input) {
  const base = emptyPortions();
  if (!input || typeof input !== 'object') return base;
  for (const key of PORTION_KEYS) {
    const v = Number(input[key]);
    if (!Number.isNaN(v) && v >= 0) base[key] = Math.min(20, Math.round(v));
  }
  return base;
}

const SCALE_MIN = 0;
const SCALE_MAX = 4;

function migrateLegacyHunger(n) {
  if (n >= 1 && n <= 5) return 5 - n;
  return n;
}

function migrateLegacySatiety(n) {
  if (n >= 1 && n <= 5) return n - 1;
  return n;
}

export function clampHunger(value, fallback = 1) {
  let n = Number(value);
  if (Number.isNaN(n)) return fallback;
  if (n > SCALE_MAX) n = migrateLegacyHunger(n);
  return Math.max(SCALE_MIN, Math.min(SCALE_MAX, Math.round(n)));
}

export function clampSatiety(value, fallback = 2) {
  let n = Number(value);
  if (Number.isNaN(n)) return fallback;
  if (n > SCALE_MAX) n = migrateLegacySatiety(n);
  return Math.max(SCALE_MIN, Math.min(SCALE_MAX, Math.round(n)));
}

export function getHungerStep(value) {
  return HUNGER_SCALE.find((s) => s.value === clampHunger(value)) || HUNGER_SCALE[1];
}

export function getSatietyStep(value) {
  return SATIETY_SCALE.find((s) => s.value === clampSatiety(value)) || SATIETY_SCALE[2];
}

export function sumPortionsFromMeals(meals) {
  const totals = emptyPortions();
  for (const meal of meals) {
    const p = normalizePortions(meal.portions);
    for (const key of PORTION_KEYS) totals[key] += p[key];
  }
  return totals;
}

function sumGroupPortions(totals, group) {
  return group.subKeys.reduce((s, key) => s + (totals[key] || 0), 0);
}

function sumLimitedProduce(totals) {
  const group = FOOD_GROUPS.find((g) => g.id === 'produce');
  return group.limitedKeys.reduce((s, key) => s + (totals[key] || 0), 0);
}

export function getPortionsProgress(meals) {
  const totals = sumPortionsFromMeals(meals);
  const limitedProduce = sumLimitedProduce(totals);

  return FOOD_GROUPS.map((g) => {
    const current = sumGroupPortions(totals, g);
    let status = 'ok';
    const alerts = [];

    if (g.dailyMin != null && current < g.dailyMin) {
      status = 'low';
      alerts.push(`Минимум ${g.dailyMin} порций`);
    }
    if (g.dailyMax != null && current > g.dailyMax) {
      status = 'high';
      alerts.push(`Максимум ${g.dailyMax} порций`);
    }

    if (g.id === 'grains' && totals.grains_bread > 1) {
      status = 'high';
      alerts.push('Хлеб — не более 1 порции в день');
    }

    if (g.id === 'produce' && limitedProduce > (g.limitedMaxPerDay || 1)) {
      status = 'high';
      alerts.push(
        'Крахмалистые овощи, сухофрукты и сок — вместе не более 1 порции'
      );
    }

    if (g.id === 'protein') {
      if (totals.protein_main > 2) alerts.push('Мясо/рыба/бобовые — до 2 порций');
      if (totals.protein_egg > 1) alerts.push('Яйца — до 1 порции');
      if (totals.protein_nuts > 1) alerts.push('Орехи — до 1 порции');
      if (alerts.length) status = 'high';
    }

    const target = g.dailyMax ?? g.dailyMin ?? 0;
    const percent = target
      ? Math.min(100, Math.round((current / target) * 100))
      : current >= (g.dailyMin || 0)
        ? 100
        : Math.round((current / (g.dailyMin || 1)) * 100);

    return {
      id: g.id,
      title: g.title,
      emoji: g.emoji,
      current,
      dailyMin: g.dailyMin,
      dailyMax: g.dailyMax,
      optional: g.optional || false,
      percent,
      status,
      alerts,
      breakdown: g.subKeys.map((key) => ({
        key,
        count: totals[key] || 0,
      })),
    };
  });
}

export async function getMeals(uid, limit = 50) {
  const db = getDb();
  if (db) {
    const snap = await db
      .collection('users')
      .doc(uid)
      .collection('meals')
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }
  return memory.meals.get(uid) || [];
}

export async function getTodayMeals(uid) {
  const meals = await getMeals(uid, 50);
  return meals.filter((m) => m.createdAt && isToday(m.createdAt));
}

export async function createMeal(uid, data) {
  const meal = {
    name: data.name.trim(),
    mealType: data.mealType || 'other',
    hungerBefore: clampHunger(data.hungerBefore),
    satietyAfter: clampSatiety(data.satietyAfter),
    portionMethod: ['plate', 'palm', 'other'].includes(data.portionMethod)
      ? data.portionMethod
      : 'palm',
    usedPlateMethod: Boolean(data.usedPlateMethod),
    plateSectors: data.plateSectors || null,
    portions: normalizePortions(data.portions),
    drank: data.drank?.trim() || '',
    notes: data.notes?.trim() || '',
    scaleVersion: 2,
    programVersion: 1,
    createdAt: new Date().toISOString(),
  };

  const db = getDb();
  if (db) {
    const ref = await db
      .collection('users')
      .doc(uid)
      .collection('meals')
      .add(meal);
    return { id: ref.id, ...meal };
  }

  const id = `mem_${Date.now()}`;
  const list = memory.meals.get(uid) || [];
  list.unshift({ id, ...meal });
  memory.meals.set(uid, list);
  return { id, ...meal };
}

export async function getTodayStats(uid) {
  const meals = await getTodayMeals(uid);
  const hunger = meals
    .map((m) => m.hungerBefore)
    .filter((v) => v !== null && v !== undefined);
  const satiety = meals
    .map((m) => m.satietyAfter)
    .filter((v) => v !== null && v !== undefined);

  const totals = sumPortionsFromMeals(meals);
  const plateMeals = meals.filter((m) => m.usedPlateMethod).length;

  return {
    count: meals.length,
    meals,
    portions: getPortionsProgress(meals),
    totals,
    sweetsToday: totals.sweets || 0,
    plateMeals,
    avgHunger: hunger.length
      ? Math.round((hunger.reduce((a, b) => a + b, 0) / hunger.length) * 10) / 10
      : null,
    avgSatiety: satiety.length
      ? Math.round((satiety.reduce((a, b) => a + b, 0) / satiety.length) * 10) / 10
      : null,
  };
}

export function buildRecommendations(stats) {
  const tips = [];
  const { meals, portions, avgHunger, avgSatiety, sweetsToday, plateMeals } = stats;

  if (!meals.length) {
    tips.push(
      'Начните дневник: запишите приём пищи, голод (0–4) до еды и насыщение (0–4) после. Порции — по методу ладони, без граммов и калорий.'
    );
    return tips;
  }

  const produce = portions.find((p) => p.id === 'produce');
  if (produce && produce.current < 5) {
    tips.push(
      `Овощей и фруктов сегодня ${produce.current} из 5+ порций. Добавьте овощи к следующему приёму (1 порция ≈ кулак).`
    );
  }

  const grains = portions.find((p) => p.id === 'grains');
  if (grains && grains.current < 3) {
    tips.push('Зерновых сегодня мало: норма 3–6 порций (горсть ладони каши/макарон).');
  }

  if (plateMeals === 0 && meals.length >= 2) {
    tips.push(
      'Попробуйте 1–2 приёма по методу тарелки: тарелка 22 см, ½ овощи/фрукты, ¼ белок, ¼ зерновые.'
    );
  }

  if (avgHunger !== null && avgHunger >= 3) {
    tips.push(
      'Едите при сильном голоде (3–4). Перекусывайте раньше — на уровне 1–2 баллов.'
    );
  }

  if (avgSatiety !== null && avgSatiety >= 3) {
    tips.push('Часто переедаете (насыщение 3–4). Ориентир — остановиться на «сыт» (2 балла).');
  }

  if (avgSatiety !== null && avgSatiety <= 1 && avgSatiety < 2) {
    tips.push(
      'После еды часто мало насыщения. Проверьте размер порции или добавьте белок/овощи.'
    );
  }

  if (sweetsToday > SWEETS_RULE.maxPerDay) {
    tips.push(SWEETS_RULE.description);
  }

  for (const p of portions) {
    for (const alert of p.alerts || []) {
      if (!tips.some((t) => t.includes(alert))) tips.push(alert);
    }
  }

  const idealHungerCount = meals.filter((m) =>
    IDEAL_HUNGER.includes(m.hungerBefore)
  ).length;
  const idealSatietyCount = meals.filter((m) =>
    IDEAL_SATIETY.includes(m.satietyAfter)
  ).length;

  if (
    meals.length >= 2 &&
    idealHungerCount >= meals.length - 1 &&
    idealSatietyCount >= meals.length - 1 &&
    tips.length <= 2
  ) {
    tips.push('Отличный ритм: умеренный голод перед едой и «сыт» после — цель программы.');
  }

  if (!tips.length) {
    tips.push('Продолжайте вести дневник: голод, насыщение и порции по методу ладони.');
  }

  return tips.slice(0, 6);
}

export function getDailyTip() {
  const dayIndex = Math.floor(Date.now() / 86400000) % DAILY_TIPS.length;
  return DAILY_TIPS[dayIndex];
}

export function getGuidePreview() {
  return (
    `*Программа питания*\n` +
    `5 групп: зерновые (3–6), белок, овощи/фрукты (5+), масла (5), молочные (0–2).\n` +
    `Метод тарелки 22 см: ½ + ¼ + ¼. Без подсчёта калорий.`
  );
}

export async function getChallenges() {
  const db = getDb();
  if (db) {
    const snap = await db.collection('challenges').get();
    if (!snap.empty) {
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    }
  }
  return DEFAULT_CHALLENGES;
}

export async function setReminder(uid, hour, minute, enabled = true) {
  const reminder = {
    hour: Number(hour),
    minute: Number(minute),
    enabled: enabled !== false,
    updatedAt: new Date().toISOString(),
  };
  const db = getDb();
  if (db) {
    await db.collection('users').doc(uid).set({ reminder }, { merge: true });
  } else {
    memory.reminders.set(uid, reminder);
  }
  return reminder;
}

export async function getReminder(uid) {
  const db = getDb();
  if (db) {
    const doc = await db.collection('users').doc(uid).get();
    return doc.data()?.reminder || null;
  }
  return memory.reminders.get(uid) || null;
}

export async function getAllActiveReminders() {
  const db = getDb();
  const result = [];
  if (db) {
    const snap = await db.collection('users').get();
    for (const doc of snap.docs) {
      const reminder = doc.data()?.reminder;
      if (reminder?.enabled) result.push({ uid: doc.id, reminder });
    }
    return result;
  }
  for (const [uid, reminder] of memory.reminders) {
    if (reminder?.enabled) result.push({ uid, reminder });
  }
  return result;
}

export async function joinChallenge(uid, challengeId) {
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
}

export function parseQuickMeal(text) {
  const name = text.trim();
  if (!name || name.length < 2) return null;
  return {
    name,
    mealType: 'other',
    hungerBefore: 1,
    satietyAfter: 2,
    portionMethod: 'palm',
    usedPlateMethod: false,
    portions: emptyPortions(),
    drank: '',
    notes: '',
  };
}

export function formatHunger(n) {
  return getHungerStep(n).title;
}

export function formatSatiety(n) {
  return getSatietyStep(n).title;
}

export function formatTodayReport(stats) {
  if (!stats.count) {
    return 'Сегодня записей нет. Добавьте приём через /add или Mini App.';
  }

  let text = `*Сегодня* (${stats.count} ${mealWord(stats.count)})\n\n`;

  if (stats.avgHunger != null) {
    text += `Голод до еды (сред.): *${stats.avgHunger}* — ${formatHunger(Math.round(stats.avgHunger))}\n`;
  }
  if (stats.avgSatiety != null) {
    text += `Насыщение после (сред.): *${stats.avgSatiety}* — ${formatSatiety(Math.round(stats.avgSatiety))}\n`;
  }
  if (stats.plateMeals) {
    text += `По методу тарелки: ${stats.plateMeals} приём(ов)\n`;
  }

  text += '\n*Порции за день:*\n';
  for (const p of stats.portions) {
    const mark = p.status === 'ok' ? '✅' : '⚠️';
    const range =
      p.dailyMin != null && p.dailyMax != null
        ? `${p.dailyMin}–${p.dailyMax}`
        : p.dailyMin != null
          ? `≥${p.dailyMin}`
          : p.dailyMax != null
            ? `≤${p.dailyMax}`
            : '';
    text += `${mark} ${p.title}: ${p.current}${range ? ` (${range})` : ''}\n`;
  }

  if (stats.sweetsToday > 0) {
    text += `\nСладкое: ${stats.sweetsToday} порц. (норма — до 1 в день)\n`;
  }

  text += '\n*Приёмы:*\n';
  for (const m of stats.meals.slice(0, 5)) {
    const time = new Date(m.createdAt).toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
    });
    const plate = m.usedPlateMethod ? ' [тарелка]' : '';
    text += `• ${time} ${m.name}${plate}\n  голод ${m.hungerBefore} → сытость ${m.satietyAfter}\n`;
  }
  return text;
}

function mealWord(n) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'приём';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'приёма';
  return 'приёмов';
}
