# Деплой на Vercel — пошагово для новичка

## Что будет в итоге

- Сайт откроется по ссылке вида: `https://ваш-проект.vercel.app`
- Это и есть адрес Mini App для Telegram-бота
- API работает на том же домене: `/api/meals`, `/health` и т.д.

---

## Шаг 1. Подготовьте GitHub

1. Убедитесь, что в репозитории есть файлы проекта (не только README).
2. **Не загружайте** файл `.env` — там секреты.
3. Должны быть: `package.json`, `vercel.json`, папки `app/`, `api/`.

Загрузите изменения:

```powershell
cd "c:\Users\zhuch\OneDrive\Документы\телеграм бот"
git add .
git commit -m "Prepare for Vercel deployment"
git push
```

---

## Шаг 2. Создайте проект на Vercel

1. Откройте [https://vercel.com](https://vercel.com) и войдите (можно через GitHub).
2. Нажмите **Add New… → Project**.
3. Выберите ваш репозиторий с ботом → **Import**.
4. Настройки сборки (обычно подставляются автоматически из `vercel.json`):
   - **Build Command:** `npm run build`
   - **Output Directory:** `app/client/dist`
5. Пока **не нажимайте Deploy** — сначала переменные окружения.

---

## Шаг 3. Переменные окружения (Environment Variables)

В разделе **Environment Variables** добавьте:

| Имя | Значение | Зачем |
|-----|----------|--------|
| `BOT_TOKEN` | токен от @BotFather | Telegram-бот |
| `WEBAPP_URL` | `https://ваш-проект.vercel.app` | ссылка на Mini App (подставите после первого деплоя) |
| `WEBHOOK_URL` | `https://ваш-проект.vercel.app/telegram/webhook` | webhook для бота |
| `NODE_ENV` | `production` | продакшен-режим |

**Firebase** (чтобы данные сохранялись на Vercel — обязательно!):

| `FIREBASE_PROJECT_ID` | из Firebase Console |
| `FIREBASE_CLIENT_EMAIL` | из service account |
| `FIREBASE_PRIVATE_KEY` | ключ целиком, `\n` как переносы строк |

**Не добавляйте** `DEV_SKIP_AUTH=true` на Vercel — иначе любой сможет писать в ваш дневник.

---

## Шаг 4. Deploy

1. Нажмите **Deploy**.
2. Подождите 1–3 минуты.
3. Если сборка **Failed** — откройте **Build Logs** и найдите красную строку с ошибкой.

Частые ошибки:
- **Could not resolve vite.config.js** — на GitHub нет папки `app/client/` или `vite.config.js`. Загрузите ВСЕ файлы проекта (см. `VERCEL_FILES.txt`). Конфиг сборки теперь в корне: `vite.config.js`.
- **Module not found** — не все файлы в GitHub → сделайте `git push` ещё раз.
- **Build failed (vite)** — проверьте, что в репозитории есть `app/client/`.

---

## Шаг 5. После успешного деплоя

1. Скопируйте URL сайта, например: `https://dnevnik-pitaniya.vercel.app`
2. В Vercel → **Settings → Environment Variables** обновите:
   - `WEBAPP_URL` = ваш URL
   - `WEBHOOK_URL` = ваш URL + `/telegram/webhook`
3. **Redeploy** (Deployments → … → Redeploy).

---

## Шаг 6. Настройте Telegram-бота

1. Откройте [@BotFather](https://t.me/BotFather).
2. `/mybots` → ваш бот → **Bot Settings** → **Menu Button** → **Configure menu button**.
3. URL Mini App = ваш `WEBAPP_URL` (https://…vercel.app).
4. Проверьте бота: `/start` → кнопка «Открыть приложение».

---

## Локальный запуск (на вашем компьютере)

```powershell
cd "c:\Users\zhuch\OneDrive\Документы\телеграм бот"
npm install
npm run dev
```

Откройте **http://localhost:5173/** (не 3000!).

В `.env` для локальной работы:

```
DEV_SKIP_AUTH=true
```

---

## Проверка бота и авторизации

Откройте в браузере (подставьте свой домен):

`https://ваш-сайт.vercel.app/api/bot-status`

Должно быть:
```json
{"tokenConfigured":true,"webhookUrl":"https://.../telegram/webhook","webappUrl":"https://..."}
```

Если `tokenConfigured: false` — добавьте **BOT_TOKEN** в Vercel → Settings → Environment Variables → **Redeploy**.

### Ошибка «Invalid or missing Telegram auth» в Mini App

1. **BOT_TOKEN** на Vercel = токен **того же бота**, что открывает Mini App (`food_diary`).
2. Не ставьте `DEV_SKIP_AUTH=true` на Vercel (только локально).
3. **WEBAPP_URL** = точный URL Vercel (`https://….vercel.app`), без `/` в конце.
4. После смены переменных — **Redeploy**.

### /start в боте не отвечает

На Vercel бот работает через **webhook**, не через polling.

1. `BOT_TOKEN` задан на Vercel.
2. `WEBHOOK_URL` = `https://ваш-сайт.vercel.app/telegram/webhook`
3. Redeploy, затем проверьте webhook в браузере (подставьте токен):
   `https://api.telegram.org/botВАШ_ТОКЕН/getWebhookInfo`
4. В ответе `"url"` должен быть ваш Vercel URL.

Если webhook пустой — вручную:
`https://api.telegram.org/botВАШ_ТОКЕН/setWebhook?url=https://ваш-сайт.vercel.app/telegram/webhook`

---

## GitHub: «папка скрыта»

GitHub **не принимает** через сайт:

| Папка | Почему |
|-------|--------|
| `node_modules` | слишком большая, генерируется через `npm install` |
| `.env` | секреты (и так в `.gitignore`) |
| `.git` внутри папки | GitHub считает вложенным репозиторием |
| Папки с точкой `.xxx` | «скрытые» системные |

**Как загружать правильно:** GitHub Desktop, или Git в терминале — загружается **код**, без `node_modules`.

Структура на GitHub должна быть:
```
корень репозитория/
  package.json
  vite.config.js
  vercel.json
  api/index.js
  app/client/...
  app/server/...
```
Не вкладывайте весь проект внутрь лишней папки «телеграм бот / телеграм бот».

| URL | Ожидание |
|-----|----------|
| `https://ваш-сайт.vercel.app/` | главная страница приложения |
| `https://ваш-сайт.vercel.app/health` | `{"ok":true,...}` |

---

## Важно про Vercel

- **Polling бота** (постоянное опрос Telegram) на Vercel не работает — используется **webhook** (уже настроено в коде).
- **Напоминания по расписанию** на Vercel не работают — нужен отдельный сервер или cron.
- **Данные без Firebase** на Vercel не сохраняются между запросами — настройте Firebase для продакшена.
