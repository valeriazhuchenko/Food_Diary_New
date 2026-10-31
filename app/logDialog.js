import {
  HUNGER_SCALE,
  SATIETY_SCALE,
  clearLogDialog,
  createMeal,
  emptyPortions,
  formatClock,
  formatHunger,
  formatSatiety,
  getLogDialog,
  isoFromClockToday,
  saveLogDialog,
} from './data.js';

const STEPS = {
  name: 'name',
  drank: 'drank',
  mealType: 'mealType',
  hunger: 'hunger',
  satiety: 'satiety',
  time: 'time',
  customTime: 'customTime',
};

const MEAL_TYPES = [
  { id: 'breakfast', label: 'Завтрак' },
  { id: 'lunch', label: 'Обед' },
  { id: 'dinner', label: 'Ужин' },
  { id: 'snack', label: 'Перекус' },
  { id: 'other', label: 'Другое' },
];

function cancelRow() {
  return [{ text: 'Отмена', callback_data: 'log:cancel' }];
}

function parseClock(text) {
  const match = String(text).trim().match(/^([01]?\d|2[0-3])[:.]([0-5]\d)$/);
  if (!match) return null;
  return { hour: Number(match[1]), minute: Number(match[2]) };
}

async function askStep(bot, chatId, step, answers = {}) {
  if (step === STEPS.name) {
    return bot.sendMessage(
      chatId,
      'Что вы ели?\nНапишите блюдо, например: гречка с курицей и салат.',
      { reply_markup: { inline_keyboard: [cancelRow()] } }
    );
  }

  if (step === STEPS.drank) {
    return bot.sendMessage(chatId, 'Что пили? Напишите или нажмите «Пропустить».', {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Пропустить', callback_data: 'log:skip_drank' }],
          cancelRow(),
        ],
      },
    });
  }

  if (step === STEPS.mealType) {
    return bot.sendMessage(chatId, 'Какой это приём пищи?', {
      reply_markup: {
        inline_keyboard: [
          MEAL_TYPES.slice(0, 3).map((t) => ({
            text: t.label,
            callback_data: `log:type:${t.id}`,
          })),
          MEAL_TYPES.slice(3).map((t) => ({
            text: t.label,
            callback_data: `log:type:${t.id}`,
          })),
          cancelRow(),
        ],
      },
    });
  }

  if (step === STEPS.hunger) {
    return bot.sendMessage(chatId, 'Голод *до* еды (0–4):', {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          HUNGER_SCALE.map((s) => ({
            text: String(s.value),
            callback_data: `log:hunger:${s.value}`,
          })),
          cancelRow(),
        ],
      },
    });
  }

  if (step === STEPS.satiety) {
    return bot.sendMessage(chatId, 'Насыщение *после* еды (0–4):', {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          SATIETY_SCALE.map((s) => ({
            text: String(s.value),
            callback_data: `log:satiety:${s.value}`,
          })),
          cancelRow(),
        ],
      },
    });
  }

  if (step === STEPS.time) {
    const now = formatClock();
    return bot.sendMessage(
      chatId,
      `На какое время записать приём?\nСейчас *${now}*.`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: `Текущее время (${now})`, callback_data: 'log:now' }],
            [{ text: 'Другое время', callback_data: 'log:pick_time' }],
            cancelRow(),
          ],
        },
      }
    );
  }

  if (step === STEPS.customTime) {
    return bot.sendMessage(
      chatId,
      'Напишите время в формате ЧЧ:ММ, например 08:30.',
      { reply_markup: { inline_keyboard: [cancelRow()] } }
    );
  }
}

async function finishLog(bot, chatId, userId, answers) {
  const meal = await createMeal(String(userId), {
    name: answers.name,
    drank: answers.drank || '',
    mealType: answers.mealType || 'other',
    hungerBefore: answers.hungerBefore,
    satietyAfter: answers.satietyAfter,
    createdAt: answers.createdAt,
    portionMethod: 'palm',
    usedPlateMethod: false,
    portions: emptyPortions(),
    notes: '',
  });
  await clearLogDialog(String(userId));

  const time = formatClock(meal.createdAt);
  const typeLabel = MEAL_TYPES.find((t) => t.id === meal.mealType)?.label || meal.mealType;
  const drankLine = meal.drank ? `\nПитьё: ${meal.drank}` : '';

  await bot.sendMessage(
    chatId,
    `Записано на *${time}* (${typeLabel}): *${meal.name}*${drankLine}\n` +
      `Голод ${meal.hungerBefore} (${formatHunger(meal.hungerBefore)}) → ` +
      `сытость ${meal.satietyAfter} (${formatSatiety(meal.satietyAfter)}).\n\n` +
      `_Порции можно уточнить в Mini App._`,
    { parse_mode: 'Markdown' }
  );
}

export async function startLogDialog(bot, chatId, userId, prefill = {}) {
  const uid = String(userId);
  const name = prefill.name?.trim();
  const answers = {};
  let step = STEPS.name;

  if (name && name.length >= 2) {
    answers.name = name;
    step = STEPS.drank;
  }

  await saveLogDialog(uid, { step, answers });
  await bot.sendMessage(chatId, 'Запись еды в чате. Отмена: кнопка «Отмена» или /cancel.');
  await askStep(bot, chatId, step, answers);
}

export async function cancelLogDialogForUser(bot, chatId, userId, silent = false) {
  await clearLogDialog(String(userId));
  if (!silent) {
    await bot.sendMessage(chatId, 'Запись еды отменена.');
  }
}

export async function handleLogCallback(bot, query) {
  const chatId = query.message?.chat?.id;
  const userId = query.from?.id;
  const data = query.data || '';
  if (!chatId || !userId || !data.startsWith('log:')) return false;

  await bot.answerCallbackQuery(query.id);

  if (data === 'log:start') {
    await startLogDialog(bot, chatId, userId);
    return true;
  }

  if (data === 'log:cancel') {
    await cancelLogDialogForUser(bot, chatId, userId);
    return true;
  }

  const uid = String(userId);
  const dialog = await getLogDialog(uid);
  if (!dialog) {
    await bot.sendMessage(chatId, 'Диалог записи уже завершён. Нажмите «Записать еду», чтобы начать снова.');
    return true;
  }

  const answers = { ...(dialog.answers || {}) };

  if (data === 'log:skip_drank' && dialog.step === STEPS.drank) {
    answers.drank = '';
    await saveLogDialog(uid, { step: STEPS.mealType, answers });
    await askStep(bot, chatId, STEPS.mealType, answers);
    return true;
  }

  if (data.startsWith('log:type:') && dialog.step === STEPS.mealType) {
    answers.mealType = data.slice('log:type:'.length);
    await saveLogDialog(uid, { step: STEPS.hunger, answers });
    await askStep(bot, chatId, STEPS.hunger, answers);
    return true;
  }

  if (data.startsWith('log:hunger:') && dialog.step === STEPS.hunger) {
    answers.hungerBefore = Number(data.slice('log:hunger:'.length));
    await saveLogDialog(uid, { step: STEPS.satiety, answers });
    await askStep(bot, chatId, STEPS.satiety, answers);
    return true;
  }

  if (data.startsWith('log:satiety:') && dialog.step === STEPS.satiety) {
    answers.satietyAfter = Number(data.slice('log:satiety:'.length));
    await saveLogDialog(uid, { step: STEPS.time, answers });
    await askStep(bot, chatId, STEPS.time, answers);
    return true;
  }

  if (data === 'log:now' && dialog.step === STEPS.time) {
    answers.createdAt = new Date().toISOString();
    await finishLog(bot, chatId, uid, answers);
    return true;
  }

  if (data === 'log:pick_time' && dialog.step === STEPS.time) {
    await saveLogDialog(uid, { step: STEPS.customTime, answers });
    await askStep(bot, chatId, STEPS.customTime, answers);
    return true;
  }

  return true;
}

export async function continueLogDialog(bot, msg) {
  const uid = String(msg.from.id);
  const chatId = msg.chat.id;
  const text = msg.text?.trim();
  if (!text) return false;

  const dialog = await getLogDialog(uid);
  if (!dialog) return false;

  const answers = { ...(dialog.answers || {}) };

  if (dialog.step === STEPS.name) {
    if (text.length < 2) {
      await bot.sendMessage(chatId, 'Напишите название блюда чуть подробнее.');
      return true;
    }
    answers.name = text;
    await saveLogDialog(uid, { step: STEPS.drank, answers });
    await askStep(bot, chatId, STEPS.drank, answers);
    return true;
  }

  if (dialog.step === STEPS.drank) {
    answers.drank = text;
    await saveLogDialog(uid, { step: STEPS.mealType, answers });
    await askStep(bot, chatId, STEPS.mealType, answers);
    return true;
  }

  if (dialog.step === STEPS.customTime) {
    const clock = parseClock(text);
    if (!clock) {
      await bot.sendMessage(chatId, 'Не понял время. Пример: 08:30 или 14:05.');
      return true;
    }
    answers.createdAt = isoFromClockToday(clock.hour, clock.minute);
    await finishLog(bot, chatId, uid, answers);
    return true;
  }

  if (dialog.step === STEPS.time && /^(сейчас|текущее)$/i.test(text)) {
    answers.createdAt = new Date().toISOString();
    await finishLog(bot, chatId, uid, answers);
    return true;
  }

  await bot.sendMessage(chatId, 'Выберите вариант кнопкой ниже или /cancel для отмены.');
  return true;
}
