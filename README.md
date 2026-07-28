# Дневник питания — Telegram Mini App

MVP: Express + Vue 3 + Firebase Firestore + Telegram Bot.

**Философия:** программа питания по методичке (метод тарелки + метод ладони, American Dietary Guidelines). Без подсчёта калорий — голод/насыщение 0–4 и порции по 5 группам продуктов.

## Структура

```
app/
  server/
    index.js       — Express, статика, запуск
    routes.js      — маршруты API и webhook
    controller.js  — бизнес-логика
    auth.js        — HMAC-проверка initData
    firebase.js    — Firestore
    telegram.js    — бот и команды
  client/
    main.js, App.vue
    components/
      MealLogger.vue
      NutritionGuide.vue
      CommunityChallenges.vue
```

## Быстрый старт

1. Скопируйте `.env.example` в `.env` и заполните:

   - `BOT_TOKEN` — от [@BotFather](https://t.me/BotFather)
   - `WEBAPP_URL` — публичный URL приложения (для Mini App)
   - Firebase credentials (опционально; без них данные хранятся в памяти)

2. Установка и запуск:

```bash
npm install
npm run dev
```

- API и бот: `http://localhost:3000`
- Vite (фронтенд): `http://localhost:5173`

3. В [@BotFather](https://t.me/BotFather) настройте Mini App:

   - `/newapp` или Menu Button → URL: ваш `WEBAPP_URL`
   - Для локальной разработки используйте [ngrok](https://ngrok.com) или аналог

4. Продакшен:

```bash
npm run build
NODE_ENV=production WEBHOOK_URL=https://your-domain.com/api/telegram/webhook npm start
```

## Команды бота

| Команда | Описание |
|---------|----------|
| `/start` | Главное меню + кнопки |
| `/help` | Полная справка |
| `/today`, `/stats` | Питание за сегодня |
| `/add блюдо` | Быстрая запись в чате (без калорий) |
| `/tip` | Совет дня |
| `/remind 12:30` | Ежедневное напоминание |
| `/log` | Mini App: логирование |
| `/guide` | Краткий справочник + Mini App |
| `/challenges` | Вызовы с кнопками участия |

Бот и Mini App используют одно хранилище (Firestore или память в dev).

## API (требует `X-Telegram-Init-Data`)

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/api/food-groups` | Группы продуктов и шкалы голода/насыщения |
| GET | `/api/portions/today` | Прогресс порций за сегодня |
| GET | `/api/meals` | Список приёмов пищи |
| POST | `/api/meals` | Создать запись (голод, порции, насыщение) |
| POST | `/api/meals/recognize` | Распознавание по фото → порции (демо) |
| GET | `/api/recommendations` | Советы по порциям и голоду |
| GET | `/api/guide` | Справочник |
| GET | `/api/challenges` | Вызовы |
| POST | `/api/challenges/join` | Участие в вызове |
| POST | `/api/reminders` | Напоминание |

## Безопасность

Все `/api/*` маршруты проверяют подпись `initData` через HMAC-SHA256 (см. `app/server/auth.js`).

## Монетизация (заготовка)

Для Telegram Stars подключите [Bot Payments API](https://core.telegram.org/bots/payments) и разблокируйте премиум-контент по флагу подписки в Firestore.
