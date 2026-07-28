<script setup>
import { ref, onMounted } from 'vue';
import { api } from '../api.js';

defineEmits(['back']);

const sections = ref([]);
const hungerScale = ref([]);
const satietyScale = ref([]);
const plateMethod = ref(null);
const loading = ref(true);
const error = ref('');
const tab = ref('program');

onMounted(async () => {
  try {
    const [guideRes, groupsRes] = await Promise.all([
      api.getGuide(),
      api.getFoodGroups(),
    ]);
    sections.value = guideRes.sections || [];
    hungerScale.value = groupsRes.hungerScale || [];
    satietyScale.value = groupsRes.satietyScale || [];
    plateMethod.value = groupsRes.plateMethod || null;
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <div>
    <button class="back-btn" @click="$emit('back')">← Назад</button>
    <h2>Программа питания</h2>
    <p class="intro">
      На основе рекомендаций American Dietary Guidelines: метод тарелки, метод ладони, без подсчёта калорий.
    </p>

    <div class="tabs">
      <button type="button" :class="{ active: tab === 'program' }" @click="tab = 'program'">
        Программа
      </button>
      <button type="button" :class="{ active: tab === 'hunger' }" @click="tab = 'hunger'">
        Голод 0–4
      </button>
      <button type="button" :class="{ active: tab === 'satiety' }" @click="tab = 'satiety'">
        Насыщение 0–4
      </button>
    </div>

    <p v-if="loading">Загрузка...</p>
    <p v-if="error" class="error">{{ error }}</p>

    <template v-if="tab === 'program'">
      <div v-if="plateMethod" class="card plate-card">
        <h3>{{ plateMethod.title }}</h3>
        <p>Тарелка {{ plateMethod.plateDiameterCm }} см, не глубокая.</p>
        <div v-for="s in plateMethod.sectors" :key="s.id" class="sector">
          <strong>{{ s.share }}</strong> — {{ s.title }}
          <small>{{ s.examples }}</small>
        </div>
        <ul>
          <li v-for="(r, i) in plateMethod.rules" :key="i">{{ r }}</li>
        </ul>
      </div>

      <div v-for="sec in sections" :key="sec.id" class="card">
        <h3>{{ sec.title }}</h3>
        <div v-for="(item, i) in sec.items" :key="i" class="guide-item">
          <strong v-if="item.title">{{ item.title }}</strong>
          <ul>
            <li v-for="(line, j) in item.text" :key="j">{{ line }}</li>
          </ul>
        </div>
      </div>
    </template>

    <template v-else-if="tab === 'hunger'">
      <div v-for="step in hungerScale" :key="step.value" class="card scale-step">
        <div class="scale-head">
          <span class="num">{{ step.value }}</span>
          <strong>{{ step.title }}</strong>
        </div>
        <p>{{ step.description }}</p>
      </div>
    </template>

    <template v-else>
      <div v-for="step in satietyScale" :key="step.value" class="card scale-step">
        <div class="scale-head">
          <span class="num">{{ step.value }}</span>
          <strong>{{ step.title }}</strong>
        </div>
        <p>{{ step.description }}</p>
      </div>
    </template>

    <p class="ideal">Ешьте при голоде 1–2, останавливайтесь на насыщении 2 («сыт»).</p>
  </div>
</template>

<style scoped>
.intro { font-size: 14px; color: #666; margin-bottom: 12px; }
.tabs { display: flex; gap: 6px; margin-bottom: 16px; flex-wrap: wrap; }
.tabs button { flex: 1; min-width: 90px; padding: 10px 8px; border: 1px solid #ddd; border-radius: 8px; background: #fff; font-size: 12px; cursor: pointer; }
.tabs button.active { background: var(--tg-theme-button-color, #3390ec); color: #fff; border-color: transparent; }
.plate-card .sector { margin: 8px 0; font-size: 14px; }
.plate-card small { display: block; color: #666; }
.guide-item { margin-bottom: 12px; }
.guide-item ul { margin: 6px 0 0; padding-left: 18px; line-height: 1.6; font-size: 14px; }
.scale-step .scale-head { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
.num { width: 28px; height: 28px; border-radius: 50%; background: #e3f2fd; color: #1565c0; display: flex; align-items: center; justify-content: center; font-weight: 700; }
.scale-step p { margin: 0; font-size: 13px; line-height: 1.55; color: #555; }
.ideal { margin-top: 16px; padding: 12px; background: #e8f5e9; border-radius: 8px; font-size: 13px; color: #2e7d32; }
</style>
