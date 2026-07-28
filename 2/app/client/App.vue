<script setup>
import { ref, onMounted } from 'vue';
import MealLogger from './components/MealLogger.vue';
import NutritionGuide from './components/NutritionGuide.vue';
import CommunityChallenges from './components/CommunityChallenges.vue';
import { getTelegramUser } from './api.js';

const screen = ref('home');
const user = ref(null);

onMounted(() => {
  user.value = getTelegramUser();
  const params = new URLSearchParams(window.location.search);
  const deepLink = params.get('screen');
  if (deepLink === 'log') screen.value = 'log';
  if (deepLink === 'guide') screen.value = 'guide';
  if (deepLink === 'challenges') screen.value = 'challenges';
});

function go(name) {
  screen.value = name;
}

function goHome() {
  screen.value = 'home';
}
</script>

<template>
  <div class="app">
    <template v-if="screen === 'home'">
      <header class="hero">
        <h1>Дневник питания</h1>
        <p v-if="user">
          Привет, {{ user.first_name }}! Ведите дневник по программе: голод и
          насыщение (0–4), метод тарелки и ладони — без калорий и весов.
        </p>
        <p v-else>
          Откройте приложение через Telegram-бота, чтобы синхронизировать данные.
        </p>
      </header>

      <div class="card features">
        <h3>Возможности</h3>
        <ul>
          <li>Шкала голода и насыщения 0–4 (как в программе)</li>
          <li>5 групп продуктов: зерновые, белок, овощи/фрукты, масла, молочные</li>
          <li>Метод тарелки 22 см и метод ладони</li>
          <li>Учёт напитков, сладостей (до 1 в день), фото еды</li>
        </ul>
      </div>

      <nav class="nav-grid">
        <button class="btn" @click="go('log')">Записать приём пищи</button>
        <button class="btn btn-secondary" @click="go('guide')">
          Справочник по питанию
        </button>
        <button class="btn btn-secondary" @click="go('challenges')">
          Вызовы сообщества
        </button>
      </nav>
    </template>

    <MealLogger v-else-if="screen === 'log'" @back="goHome" />
    <NutritionGuide v-else-if="screen === 'guide'" @back="goHome" />
    <CommunityChallenges v-else-if="screen === 'challenges'" @back="goHome" />
  </div>
</template>

<style scoped>
.hero h1 {
  font-size: 26px;
}

.features ul {
  margin: 0;
  padding-left: 20px;
  line-height: 1.8;
  font-size: 15px;
}
</style>
