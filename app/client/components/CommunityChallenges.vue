<script setup>
import { ref, onMounted } from 'vue';
import { api, haptic } from '../api.js';

defineEmits(['back']);

const challenges = ref([]);
const joined = ref([]);
const loading = ref(true);
const error = ref('');
const reminderHour = ref(12);
const reminderMinute = ref(0);

onMounted(load);

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const [chRes, mineRes] = await Promise.all([
      api.getChallenges(),
      api.getMyChallenges(),
    ]);
    challenges.value = chRes.challenges || [];
    joined.value = mineRes.joined || [];
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}

async function join(challengeId) {
  try {
    await api.joinChallenge(challengeId);
    if (!joined.value.includes(challengeId)) {
      joined.value.push(challengeId);
    }
    haptic('medium');
  } catch (e) {
    error.value = e.message;
  }
}

async function saveReminder() {
  try {
    await api.setReminder({
      hour: reminderHour.value,
      minute: reminderMinute.value,
      enabled: true,
    });
    haptic('light');
    error.value = '';
  } catch (e) {
    error.value = e.message;
  }
}

function isJoined(id) {
  return joined.value.includes(id);
}
</script>

<template>
  <div>
    <button class="back-btn" @click="$emit('back')">← Назад</button>
    <h2>Вызовы сообщества</h2>
    <p>Участвуйте в вызовах и достигайте целей вместе с друзьями.</p>

    <p v-if="loading">Загрузка...</p>
    <p v-if="error" class="error">{{ error }}</p>

    <div v-for="ch in challenges" :key="ch.id" class="card">
      <h3>{{ ch.title }}</h3>
      <p>{{ ch.description }}</p>
      <span v-if="ch.participants" class="badge">{{ ch.participants }} участников</span>
      <button
        class="btn"
        :class="{ 'btn-secondary': isJoined(ch.id) }"
        :disabled="isJoined(ch.id)"
        style="margin-top: 12px"
        @click="join(ch.id)"
      >
        {{ isJoined(ch.id) ? 'Вы участвуете' : 'Присоединиться' }}
      </button>
    </div>

    <div class="card">
      <h3>Напоминания</h3>
      <p>Настройте ежедневное напоминание о записи питания.</p>
      <div class="reminder-row">
        <input v-model.number="reminderHour" type="number" min="0" max="23" />
        <span>:</span>
        <input v-model.number="reminderMinute" type="number" min="0" max="59" />
      </div>
      <button class="btn btn-secondary" @click="saveReminder">Сохранить напоминание</button>
    </div>
  </div>
</template>

<style scoped>
.reminder-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.reminder-row input {
  width: 72px;
  margin-bottom: 0;
}
</style>
