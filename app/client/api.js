const tg = () => window.Telegram?.WebApp;

function getInitData() {
  return tg()?.initData || '';
}

async function request(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    'X-Telegram-Init-Data': getInitData(),
    ...options.headers,
  };

  const res = await fetch(`/api${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return data;
}

export const api = {
  getFoodGroups: () => request('/food-groups'),
  getPortionsToday: () => request('/portions/today'),
  getMeals: () => request('/meals'),
  createMeal: (body) =>
    request('/meals', { method: 'POST', body: JSON.stringify(body) }),
  getRecommendations: () => request('/recommendations'),
  recognizePhoto: (imageBase64) =>
    request('/meals/recognize', {
      method: 'POST',
      body: JSON.stringify({ imageBase64 }),
    }),
  getGuide: () => request('/guide'),
  getChallenges: () => request('/challenges'),
  joinChallenge: (challengeId) =>
    request('/challenges/join', {
      method: 'POST',
      body: JSON.stringify({ challengeId }),
    }),
  getMyChallenges: () => request('/challenges/mine'),
  setReminder: (body) =>
    request('/reminders', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
};

export function getTelegramUser() {
  return tg()?.initDataUnsafe?.user || null;
}

export function haptic(type = 'light') {
  tg()?.HapticFeedback?.impactOccurred(type);
}
