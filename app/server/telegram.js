import TelegramBot from 'node-telegram-bot-api';
import {
  formatTodayReport,
  getChallenges,
  getDailyTip,
  getGuidePreview,
  getReminder,
  getTodayStats,
  joinChallenge,
  setReminder,
} from './services/data.js';
import {
  cancelLogDialogForUser,
  continueLogDialog,
  handleLogCallback,
  startLogDialog,
} from './services/logDialog.js';

let bot = null;

const COMMANDS = [
  { command: 'start', description: 'Главное меню' },
  { command: 'help', description: 'Справка по командам' },
  { command: 'today', description: 'Питание за сегодня' },
  { command: 'stats', description: 'Статистика за день' },
  { command: 'add', description: 'Записать еду через вопросы в чате' },
  { command: 'cancel', description: 'Отменить запись еды' },
  { command: 'tip', description: 'Совет дня' },
  { command: 'log', description: 'Открыть логирование' },
  { command: 'guide', description: 'Справочник по питанию' },
  { command: 'challenges', description: 'Вызовы сообщества' },
  { command: 'remind', description: 'Напоминание: /remind 12:30' },
];

function webAppUrl(path = '') {
  const base =
    process.env.WEBAPP_URL || `http://localhost:${process.env.PORT || 3000}`;
  return path ? `${base}?screen=${path}` : base;
}

function mainMenuKeyboard() {
  return {
    inline_keyboard: [
      [{ text: 'Открыть приложение', web_app: { url: webAppUrl() } }],
      [
        { text: 'Сегодня', callback_data: 'today' },
        { text: 'Совет дня', callback_data: 'tip' },
      ],
      [
        { text: 'Записать еду', callback_data: 'log' },
        { text: 'Справочник', callback_data: 'guide' },
      ],
      [{ text: 'Вызовы', callback_data: 'challenges' }],
    ],
  };
}

function replyMenuKeyboard() {
  return {
    keyboard: [
      [{ text: 'Сегодня' }, { text: 'Совет дня' }],
      [{ text: 'Записать еду' }, { text: 'Открыть приложение' }],
    ],
    resize_keyboard: true,
  };
}

export function getBot() {
  return bot;
}

function commandText(msg) {
  return msg.text?.split('@')[0]?.trim() ?? '';
}

async function handleStart(msg) {
  const name = msg.from?.first_name || 'друг';
  await bot.sendMessage(
    msg.chat.id,
    `Привет, ${name}! Это *Дневник питания*.\n\n` +
      `Дневник по программе: голод/насыщение 0–4, метод тарелки и ладони.\n` +
      `Без калорий. /help — команды.`,
    {
      parse_mode: 'Markdown',
      reply_markup: mainMenuKeyboard(),
    }
  );
  await bot.sendMessage(msg.chat.id, 'Быстрые кнопки:', {
    reply_markup: replyMenuKeyboard(),
  });
}

async function handleHelp(msg) {
  await bot.sendMessage(
    msg.chat.id,
    `*Команды бота*\n\n` +
      `/start — главное меню\n` +
      `/today — записи за сегодня\n` +
      `/stats — сводка за день\n` +
      `/add — записать еду через вопросы в чате\n` +
      `/cancel — отменить запись\n` +
      `/tip — совет дня\n` +
      `/remind 12:30 — напоминание\n` +
      `/log — Mini App: порции и подробная запись\n` +
      `/guide — нормы порций по группам\n` +
      `/challenges — вызовы\n\n` +
      `_Дневник без калорий: голод, насыщение и порции продуктов._`,
    { parse_mode: 'Markdown' }
  );
}

async function handleAdd(msg, match) {
  const name = match[1]?.trim();
  return startLogDialog(bot, msg.chat.id, msg.from.id, { name });
}

async function handleRemind(msg, match) {
  if (!match[1]) {
    const current = await getReminder(String(msg.from.id));
    const text = current
      ? `Напоминание: ${String(current.hour).padStart(2, '0')}:${String(current.minute).padStart(2, '0')}`
      : 'Напоминание не задано. Пример: `/remind 12:30`';
    return bot.sendMessage(msg.chat.id, text, { parse_mode: 'Markdown' });
  }

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) {
    return bot.sendMessage(msg.chat.id, 'Укажите время в формате ЧЧ:ММ, например 12:30');
  }

  await setReminder(String(msg.from.id), hour, minute);
  await bot.sendMessage(
    msg.chat.id,
    `Напоминание установлено на ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')} каждый день.`
  );
}

async function handleLog(msg) {
  await bot.sendMessage(msg.chat.id, 'Логирование питания в приложении:', {
    reply_markup: {
      inline_keyboard: [
        [{ text: 'Логировать', web_app: { url: webAppUrl('log') } }],
      ],
    },
  });
}

async function handleGuide(msg) {
  await bot.sendMessage(
    msg.chat.id,
    `*Справочник (кратко)*\n\n${getGuidePreview()}`,
    { parse_mode: 'Markdown' }
  );
  await bot.sendMessage(msg.chat.id, 'Полная версия в приложении:', {
    reply_markup: {
      inline_keyboard: [
        [{ text: 'Открыть справочник', web_app: { url: webAppUrl('guide') } }],
      ],
    },
  });
}

async function handleCallbackQuery(query) {
  const chatId = query.message?.chat?.id;
  const userId = query.from?.id;
  if (!chatId || !userId) return;

  const data = query.data || '';
  await bot.answerCallbackQuery(query.id);

  if (data === 'today') return sendTodayReport(chatId, userId);
  if (data === 'tip') {
    return bot.sendMessage(chatId, getDailyTip());
  }
  if (data === 'log') {
    return startLogDialog(bot, chatId, userId);
  }
  if (data === 'guide') {
    return bot.sendMessage(chatId, 'Справочник:', {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Открыть', web_app: { url: webAppUrl('guide') } }],
        ],
      },
    });
  }
  if (data === 'challenges') return sendChallengesList(chatId);
  if (data.startsWith('join:')) {
    const challengeId = data.slice(5);
    await joinChallenge(String(userId), challengeId);
    return bot.sendMessage(chatId, 'Вы присоединились к вызову.');
  }
}

async function handlePlainText(msg) {
  const text = msg.text.trim();

  if (text === 'Сегодня') return sendTodayReport(msg.chat.id, msg.from.id);
  if (text === 'Совет дня') {
    return bot.sendMessage(msg.chat.id, getDailyTip());
  }
  if (text === 'Записать еду') {
    return startLogDialog(bot, msg.chat.id, msg.from.id);
  }
  if (text === 'Открыть приложение') {
    return bot.sendMessage(msg.chat.id, 'Mini App:', {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Открыть', web_app: { url: webAppUrl() } }],
        ],
      },
    });
  }
}

const MENU_TEXTS = ['Сегодня', 'Совет дня', 'Записать еду', 'Открыть приложение'];

async function dispatchUpdate(update) {
  if (!bot) return;

  if (update.callback_query) {
    const data = update.callback_query.data || '';
    if (data.startsWith('log:')) {
      await handleLogCallback(bot, update.callback_query);
      return;
    }
    await handleCallbackQuery(update.callback_query);
    return;
  }

  const msg = update.message;
  if (!msg?.text) return;

  const text = commandText(msg);
  if (!text) return;

  const chatId = msg.chat.id;
  const userId = msg.from.id;

  if (text === '/cancel') {
    return cancelLogDialogForUser(bot, chatId, userId);
  }

  if (text === '/start') {
    await cancelLogDialogForUser(bot, chatId, userId, true);
    return handleStart(msg);
  }
  if (text === '/help') {
    await cancelLogDialogForUser(bot, chatId, userId, true);
    return handleHelp(msg);
  }
  if (/^\/today|^\/stats/.test(text)) {
    await cancelLogDialogForUser(bot, chatId, userId, true);
    return sendTodayReport(chatId, userId);
  }

  const addMatch = text.match(/^\/add(?:\s+(.+))?$/s);
  if (addMatch) return handleAdd(msg, addMatch);

  if (text === '/tip') {
    await cancelLogDialogForUser(bot, chatId, userId, true);
    return bot.sendMessage(chatId, `*Совет дня*\n\n${getDailyTip()}`, {
      parse_mode: 'Markdown',
    });
  }

  const remindMatch = text.match(/^\/remind(?:\s+(\d{1,2}):(\d{2}))?$/);
  if (remindMatch) {
    await cancelLogDialogForUser(bot, chatId, userId, true);
    return handleRemind(msg, remindMatch);
  }

  if (text === '/log') {
    await cancelLogDialogForUser(bot, chatId, userId, true);
    return handleLog(msg);
  }
  if (text === '/guide') {
    await cancelLogDialogForUser(bot, chatId, userId, true);
    return handleGuide(msg);
  }
  if (text === '/challenges') {
    await cancelLogDialogForUser(bot, chatId, userId, true);
    return sendChallengesList(chatId);
  }

  if (text === 'Записать еду') {
    return startLogDialog(bot, chatId, userId);
  }

  if (MENU_TEXTS.includes(text)) {
    await cancelLogDialogForUser(bot, chatId, userId, true);
    return handlePlainText(msg);
  }

  if (!text.startsWith('/')) {
    const handled = await continueLogDialog(bot, msg);
    if (handled) return;
    return handlePlainText(msg);
  }
}

export function initTelegram(options = {}) {
  const token = process.env.BOT_TOKEN?.trim();
  if (!token || token.includes('your_bot') || token === 'your_bot_token_from_botfather') {
    console.warn('[telegram] BOT_TOKEN not configured — bot disabled (browser dev OK)');
    return null;
  }

  const useWebhook =
    options.serverless ||
    Boolean(process.env.WEBHOOK_URL) ||
    process.env.VERCEL === '1';

  if (useWebhook) {
    bot = new TelegramBot(token);
    const webhookUrl =
      process.env.WEBHOOK_URL ||
      (process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}/telegram/webhook`
        : null);
    if (webhookUrl) {
      bot
        .setWebHook(webhookUrl)
        .then(() => console.log('[telegram] webhook set:', webhookUrl))
        .catch((err) => console.warn('[telegram] setWebHook failed:', err.message));
    } else {
      console.warn('[telegram] WEBHOOK_URL not set — /start не будет работать на Vercel');
    }
  } else {
    bot = new TelegramBot(token, { polling: true });
  }

  bot.setMyCommands(COMMANDS).catch(() => {});

  bot.on('message', (msg) => {
    dispatchUpdate({ message: msg }).catch(logHandlerError);
  });
  bot.on('callback_query', (query) => {
    dispatchUpdate({ callback_query: query }).catch(logHandlerError);
  });

  return bot;
}

async function sendTodayReport(chatId, userId) {
  if (!bot) return;
  const stats = await getTodayStats(String(userId));
  await bot.sendMessage(chatId, formatTodayReport(stats), {
    parse_mode: 'Markdown',
    reply_markup: mainMenuKeyboard(),
  });
}

async function sendChallengesList(chatId) {
  if (!bot) return;
  const list = await getChallenges();
  let text = '*Вызовы сообщества*\n\n';
  for (const ch of list) {
    text += `• *${ch.title}* — ${ch.description}\n`;
  }
  text += '\nПрисоединиться: нажмите кнопку или откройте приложение.';

  const buttons = list.slice(0, 3).map((ch) => [
    { text: `Участвовать: ${ch.title}`, callback_data: `join:${ch.id}` },
  ]);
  buttons.push([
    { text: 'Все вызовы в приложении', web_app: { url: webAppUrl('challenges') } },
  ]);

  await bot.sendMessage(chatId, text, {
    parse_mode: 'Markdown',
    reply_markup: { inline_keyboard: buttons },
  });
}

function logHandlerError(err) {
  console.error('[telegram]', err?.response?.body || err?.message || err);
}

export async function processWebhookUpdate(update) {
  try {
    await dispatchUpdate(update);
  } catch (err) {
    logHandlerError(err);
  }
}
