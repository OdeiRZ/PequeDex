import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import { i18n } from './i18n'
import { applyTheme, getStoredTheme } from './theme'
import { vPress } from './directives/press'
import { startSnapshotSync } from './lib/snapshotSync'
import { initErrorReporting } from './lib/errorReporting'
import { warmUpApi } from './lib/backgroundSync'
import { registerServiceWorker } from './lib/serviceWorker'

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

// Despierta la API (Render la duerme tras ~15 min sin tráfico y tarda hasta ~50 s
// en arrancar): al abrir la app ya está arrancando mientras se toca la pantalla.
warmUpApi()

// Errores del frontend a Sentry (solo si el build lleva VITE_SENTRY_DSN); se
// carga después de montar para no pesar en el arranque.
void initErrorReporting(app)

// Service worker (sw/sw.template.js): guarda la app para abrirla sin conexion y avisa
// cuando hay una version nueva. Solo en el build de produccion.
registerServiceWorker()
