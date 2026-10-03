/// <reference types="vite/client" />

// View Transitions API - aun no esta en el lib.dom.d.ts que trae el
// TypeScript de este proyecto, aunque si la implementan los navegadores que
// la soportan (Chrome/Edge, Safari 18+). Solo se declara la forma minima que
// usa ThemeToggle.vue (el callback de actualizacion del DOM + `ready`, nada
// de `updateCallbackDone`/`finished`/`skipTransition` que no se usan aqui).
interface Document {
  startViewTransition?(updateCallback: () => void): { ready: Promise<void> }
}
