<script setup>
import { ref, onMounted, computed } from 'vue';
import { api, haptic } from '../api.js';
import { PORTION_LABELS as FALLBACK_LABELS } from '../portionLabels.js';

defineEmits(['back']);

const meals = ref([]);
const tips = ref([]);
const portions = ref([]);
const foodGroups = ref([]);
const portionLabels = ref({});
const hungerScale = ref([]);
const satietyScale = ref([]);
const plateMethod = ref(null);
const sweetsRule = ref(null);
const loading = ref(false);
const error = ref('');
const saving = ref(false);

const MEAL_TYPES = [
  { id: 'breakfast', label: 'Завтрак' },
  { id: 'lunch', label: 'Обед' },
  { id: 'dinner', label: 'Ужин' },
  { id: 'snack', label: 'Перекус' },
  { id: 'other', label: 'Другое' },
];

const form = ref({
  name: '',
  mealType: 'lunch',
  hungerBefore: 1,
  satietyAfter: 2,
  usedPlateMethod: false,
  portions: {},
  drank: '',
  notes: '',
});

const PORTION_GROUPS = [
  {
    title: 'Зерновые (3–6 в день, хлеб ≤1)',
    keys: ['grains', 'grains_bread'],
  },
  {
    title: 'Белковые (мясо/рыба ≤2, яйцо ≤1, орехи ≤1)',
    keys: ['protein_main', 'protein_egg', 'protein_nuts'],
  },
  {
    title: 'Овощи и фрукты (мин. 5, крахмал/сок/сухофрукты ≤1 вместе)',
    keys: [
      'produce_fist',
      'produce_greens',
      'produce_starchy',
      'produce_dried',
      'produce_juice',
    ],
  },
  {
    title: 'Масла (5 ч. л. в день)',
    keys: ['oils'],
  },
  {
    title: 'Молочные (0–2, по желанию)',
    keys: ['dairy'],
  },
  {
    title: 'Сладости (≤1 в день)',
    keys: ['sweets'],
  },
];

onMounted(loadData);

async function loadData() {
  loading.value = true;
  error.value = '';
  try {
    const [groupsRes, mealsRes, recRes, portRes] = await Promise.all([
      api.getFoodGroups(),
      api.getMeals(),
      api.getRecommendations(),
      api.getPortionsToday(),
    ]);
    foodGroups.value = groupsRes.groups || [];
    portionLabels.value = groupsRes.portionLabels || {};
    hungerScale.value = groupsRes.hungerScale || [];
    satietyScale.value = groupsRes.satietyScale || [];
    plateMethod.value = groupsRes.plateMethod || null;
    sweetsRule.value = groupsRes.sweetsRule || null;
    initPortions();
    meals.value = mealsRes.meals || [];
    tips.value = recRes.tips || [];
    portions.value = portRes.portions || [];
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}

function initPortions() {
  const p = {};
  for (const g of PORTION_GROUPS) {
    for (const key of g.keys) p[key] = 0;
  }
  form.value.portions = p;
}

function changePortion(key, delta) {
  const cur = form.value.portions[key] || 0;
  form.value.portions[key] = Math.max(0, Math.min(10, cur + delta));
}

async function submit() {
  if (!form.value.name.trim()) {
    error.value = 'Укажите, что вы ели и пили';
    return;
  }
  saving.value = true;
  error.value = '';
  try {
    await api.createMeal({
      ...form.value,
      portionMethod: form.value.usedPlateMethod ? 'plate' : 'palm',
    });
    haptic('medium');
    form.value.name = '';
    form.value.drank = '';
    form.value.notes = '';
    form.value.hungerBefore = 1;
    form.value.satietyAfter = 2;
    form.value.usedPlateMethod = false;
    initPortions();
    await loadData();
  } catch (e) {
    error.value = e.message;
  } finally {
    saving.value = false;
  }
}

async function onPhotoChange(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async () => {
    loading.value = true;
    try {
      const { suggestion } = await api.recognizePhoto(reader.result.split(',')[1]);
      form.value.name = suggestion.name;
      form.value.usedPlateMethod = suggestion.usedPlateMethod || false;
      if (suggestion.portions) {
        form.value.portions = { ...form.value.portions, ...suggestion.portions };
      }
      form.value.notes = suggestion.note || '';
      haptic('light');
    } catch (e) {
      error.value = e.message;
    } finally {
      loading.value = false;
    }
  };
  reader.readAsDataURL(file);
}

const currentHunger = computed(() =>
  hungerScale.value.find((s) => s.value === form.value.hungerBefore)
);
const currentSatiety = computed(() =>
  satietyScale.value.find((s) => s.value === form.value.satietyAfter)
);

function label(key) {
  return portionLabels.value[key] || FALLBACK_LABELS[key] || key;
}

function formatPortionsLine(meal) {
  if (!meal.portions) return '';
  return Object.entries(meal.portions)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => `${label(k)}: ${v}`)
    .join(' · ');
}

function hungerTitle(v) {
  return hungerScale.value.find((s) => s.value === v)?.title || v;
}
function satietyTitle(v) {
  return satietyScale.value.find((s) => s.value === v)?.title || v;
}
</script>

<template>
  <div>
    <button class="back-btn" @click="$emit('back')">← Назад</button>
    <h2>Дневник питания</h2>
    <p class="subtitle">
      По программе: без калорий и граммов — голод/насыщение (0–4), метод тарелки и ладони.
    </p>

    <div v-if="portions.length" class="card">
      <h3>Порции за сегодня</h3>
      <div v-for="p in portions" :key="p.id" class="portion-row" :class="p.status">
        <div class="portion-label">
          <span>{{ p.emoji }} {{ p.title }}</span>
          <span class="portion-count">{{ p.current }}
            <template v-if="p.dailyMin != null && p.dailyMax != null">
              / {{ p.dailyMin }}–{{ p.dailyMax }}
            </template>
            <template v-else-if="p.dailyMin != null"> / ≥{{ p.dailyMin }}</template>
            <template v-else-if="p.dailyMax != null"> / ≤{{ p.dailyMax }}</template>
          </span>
        </div>
        <div class="portion-bar">
          <div class="portion-fill" :style="{ width: Math.min(p.percent, 100) + '%' }" />
        </div>
        <p v-for="(a, i) in p.alerts" :key="i" class="alert-line">{{ a }}</p>
      </div>
    </div>

    <div v-if="tips.length" class="card">
      <h3>Рекомендации</h3>
      <div v-for="(tip, i) in tips" :key="i" class="tip">{{ tip }}</div>
    </div>

    <div class="card">
      <label>Что ели</label>
      <input v-model="form.name" placeholder="Например: гречка, курица, салат" />

      <label>Что пили (вода, чай, кофе…)</label>
      <input v-model="form.drank" placeholder="Стакан воды, чай без сахара…" />

      <label>Тип приёма</label>
      <select v-model="form.mealType">
        <option v-for="t in MEAL_TYPES" :key="t.id" :value="t.id">{{ t.label }}</option>
      </select>

      <label class="checkbox-row">
        <input v-model="form.usedPlateMethod" type="checkbox" />
        Этот приём по методу тарелки (22 см: ½ овощи/фрукты, ¼ белок, ¼ зерновые)
      </label>

      <div v-if="form.usedPlateMethod && plateMethod" class="plate-hint">
        <div
          v-for="s in plateMethod.sectors"
          :key="s.id"
          class="plate-sector"
        >
          <strong>{{ s.share }}</strong> — {{ s.title }}
        </div>
      </div>

      <label>Фото еды</label>
      <input type="file" accept="image/*" capture="environment" @change="onPhotoChange" />

      <div class="scale-block">
        <label>Голод до еды — {{ form.hungerBefore }} балл</label>
        <input v-model.number="form.hungerBefore" type="range" min="0" max="4" step="1" />
        <div v-if="currentHunger" class="scale-desc">
          <strong>{{ currentHunger.title }}</strong>
          <p>{{ currentHunger.description }}</p>
        </div>
      </div>

      <div class="scale-block">
        <label>Насыщение после — {{ form.satietyAfter }} балл</label>
        <input v-model.number="form.satietyAfter" type="range" min="0" max="4" step="1" />
        <div v-if="currentSatiety" class="scale-desc">
          <strong>{{ currentSatiety.title }}</strong>
          <p>{{ currentSatiety.description }}</p>
        </div>
      </div>

      <p class="hint ideal">Ориентир: голод 1–2 перед едой, насыщение 2 после.</p>

      <h3 class="section-title">Порции в приёме (метод ладони)</h3>

      <div v-for="group in PORTION_GROUPS" :key="group.title" class="portion-group">
        <h4>{{ group.title }}</h4>
        <div v-for="key in group.keys" :key="key" class="portion-picker">
          <span>{{ label(key) }}</span>
          <div class="stepper">
            <button type="button" class="step-btn" @click="changePortion(key, -1)">−</button>
            <span>{{ form.portions[key] || 0 }}</span>
            <button type="button" class="step-btn" @click="changePortion(key, 1)">+</button>
          </div>
        </div>
      </div>

      <p v-if="sweetsRule" class="hint">{{ sweetsRule.description }}</p>

      <label>Заметки</label>
      <textarea v-model="form.notes" rows="2" placeholder="Самочувствие, обстановка…" />

      <p v-if="error" class="error">{{ error }}</p>
      <button class="btn" :disabled="saving" @click="submit">
        {{ saving ? 'Сохранение...' : 'Сохранить' }}
      </button>
    </div>

    <div class="card">
      <h3>История</h3>
      <p v-if="loading">Загрузка...</p>
      <p v-else-if="!meals.length">Пока нет записей</p>
      <div v-for="meal in meals" :key="meal.id" class="meal-item">
        <strong>{{ meal.name }}</strong>
        <span v-if="meal.usedPlateMethod" class="badge">тарелка</span>
        <div v-if="meal.drank" class="meal-meta">Пили: {{ meal.drank }}</div>
        <div class="meal-meta">
          Голод {{ meal.hungerBefore }} ({{ hungerTitle(meal.hungerBefore) }}) →
          {{ meal.satietyAfter }} ({{ satietyTitle(meal.satietyAfter) }})
        </div>
        <div v-if="formatPortionsLine(meal)" class="meal-portions">
          {{ formatPortionsLine(meal) }}
        </div>
        <small>{{ new Date(meal.createdAt).toLocaleString('ru-RU') }}</small>
      </div>
    </div>
  </div>
</template>

<style scoped>
.subtitle { font-size: 14px; color: #666; margin-bottom: 16px; }
.section-title { margin-top: 16px; font-size: 16px; }
.hint { font-size: 13px; color: #888; margin: 8px 0; }
.hint.ideal { background: #e8f5e9; padding: 10px; border-radius: 8px; color: #2e7d32; }
.portion-row { margin-bottom: 12px; }
.portion-row.high { background: #fff3e0; margin: 0 -8px; padding: 8px; border-radius: 8px; }
.portion-label { display: flex; justify-content: space-between; font-size: 14px; margin-bottom: 4px; }
.portion-count { font-weight: 600; }
.portion-bar { height: 8px; background: #eee; border-radius: 4px; overflow: hidden; }
.portion-fill { height: 100%; background: var(--tg-theme-button-color, #3390ec); transition: width 0.2s; }
.alert-line { font-size: 12px; color: #e65100; margin: 4px 0 0; }
.scale-block { margin-bottom: 16px; }
.scale-block input[type='range'] { width: 100%; margin: 8px 0; }
.scale-desc { margin-top: 8px; padding: 12px; background: #f8f9fa; border-radius: 10px; border-left: 3px solid var(--tg-theme-button-color, #3390ec); }
.scale-desc p { margin: 6px 0 0; font-size: 13px; line-height: 1.5; color: #444; }
.checkbox-row { display: flex; align-items: flex-start; gap: 8px; font-size: 14px; margin: 12px 0; }
.plate-hint { background: #e3f2fd; padding: 10px; border-radius: 8px; margin-bottom: 12px; font-size: 13px; }
.plate-sector { margin-bottom: 4px; }
.portion-group { margin-bottom: 16px; }
.portion-group h4 { font-size: 14px; margin: 0 0 8px; color: #333; }
.portion-picker { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #f0f0f0; font-size: 14px; }
.stepper { display: flex; align-items: center; gap: 10px; }
.step-btn { width: 32px; height: 32px; border: 1px solid #ddd; border-radius: 8px; background: #fff; cursor: pointer; }
.meal-meta { font-size: 13px; color: #555; }
.meal-portions { font-size: 12px; color: #777; }
.badge { font-size: 11px; background: #e3f2fd; color: #1565c0; padding: 2px 6px; border-radius: 8px; margin-left: 6px; }
</style>
