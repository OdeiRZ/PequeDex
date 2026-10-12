import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import { i18n } from './i18n'
import { applyTheme, getStoredTheme } from './theme'
import { vPress } from './directives/press'
import { startSnapshotSync } from './lib/snapshotSync'

// Applied before mount, not inside a component's onMounted, so the correct
// theme is already on <html> for the very first paint - otherwise a stored
// dark/light override would flash the wrong theme for one frame.
applyTheme(getStoredTheme())

const app = createApp(App)

const pinia = createPinia()
app.use(pinia)
app.use(router)
app.use(i18n)
app.directive('press', vPress)

// La foto del Dashboard para pintarlo al instante la próxima vez que se abra.
startSnapshotSync(pinia)

app.mount('#app')

// Registra un service worker vacío (ver public/sw.js) - no da soporte
// offline, solo existe porque algunos navegadores (Chrome en Android) solo
// ofrecen "Instalar app"/"Añadir a pantalla de inicio" para una página
// controlada por un service worker con un fetch handler, haga lo que haga.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {})
  })
}
