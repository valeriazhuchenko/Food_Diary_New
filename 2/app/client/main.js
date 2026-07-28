import { createApp } from 'vue';
import App from './App.vue';
import './styles.css';

const tg = window.Telegram?.WebApp;
if (tg) {
  tg.ready();
  tg.expand();
  document.documentElement.style.setProperty(
    '--tg-theme-bg-color',
    tg.themeParams.bg_color || '#ffffff'
  );
  document.documentElement.style.setProperty(
    '--tg-theme-text-color',
    tg.themeParams.text_color || '#000000'
  );
  document.documentElement.style.setProperty(
    '--tg-theme-button-color',
    tg.themeParams.button_color || '#3390ec'
  );
  document.documentElement.style.setProperty(
    '--tg-theme-button-text-color',
    tg.themeParams.button_text_color || '#ffffff'
  );
}

createApp(App).mount('#app');
