import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import { i18n } from './i18n'
import { applyTheme, getStoredTheme } from './theme'

// Applied before mount, not inside a component's onMounted, so the correct
// theme is already on <html> for the very first paint - otherwise a stored
// dark/light override would flash the wrong theme for one frame.
applyTheme(getStoredTheme())

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(i18n)

app.mount('#app')
