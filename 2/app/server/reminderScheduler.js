import { getAllActiveReminders } from './services/data.js';
import { getBot } from './telegram.js';

const sentToday = new Map();

function todayKey(uid) {
  const d = new Date();
  return `${uid}:${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export function startReminderScheduler() {
  setInterval(async () => {
    const bot = getBot();
    if (!bot) return;

    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();

    try {
      const reminders = await getAllActiveReminders();
      for (const { uid, reminder } of reminders) {
        if (reminder.hour !== hour || reminder.minute !== minute) continue;

        const key = todayKey(uid);
        if (sentToday.get(key)) continue;
        sentToday.set(key, true);

        await bot.sendMessage(
          uid,
          'Напоминание: время записать приём пищи в дневник.',
          {
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: 'Открыть дневник',
                    web_app: {
                      url:
                        process.env.WEBAPP_URL ||
                        `http://localhost:${process.env.PORT || 3000}`,
                    },
                  },
                ],
              ],
            },
          }
        );
      }
    } catch (err) {
      console.error('[reminders]', err.message);
    }

    if (sentToday.size > 5000) {
      sentToday.clear();
    }
  }, 60_000);
}
