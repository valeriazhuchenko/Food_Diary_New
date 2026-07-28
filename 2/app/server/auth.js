import crypto from 'crypto';

/**
 * Validates Telegram Mini App initData using HMAC-SHA256.
 * @see https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
export function validateInitData(initData, botToken) {
  if (!initData || !botToken) return null;

  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return null;

  params.delete('hash');
  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  const secretKey = crypto
    .createHmac('sha256', 'WebAppData')
    .update(botToken)
    .digest();

  const calculatedHash = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');

  if (calculatedHash !== hash) return null;

  const authDate = Number(params.get('auth_date'));
  const maxAgeSec = 86400;
  if (authDate && Date.now() / 1000 - authDate > maxAgeSec) return null;

  const userRaw = params.get('user');
  if (!userRaw) return null;

  try {
    return JSON.parse(userRaw);
  } catch {
    return null;
  }
}

export function authMiddleware(req, res, next) {
  const initData =
    req.headers['x-telegram-init-data'] ||
    req.body?.initData ||
    req.query?.initData;

  const token = process.env.BOT_TOKEN?.trim();
  const user = validateInitData(initData, token);
  if (user) {
    req.telegramUser = user;
    return next();
  }

  if (process.env.DEV_SKIP_AUTH === 'true') {
    req.telegramUser = { id: 1, first_name: 'Dev', username: 'dev' };
    return next();
  }

  return res.status(401).json({
    error: 'Invalid or missing Telegram auth',
    hint:
      'Проверьте BOT_TOKEN на Vercel — он должен быть от того же бота, что открывает Mini App (food_diary).',
  });
}
