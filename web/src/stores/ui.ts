import { defineStore } from 'pinia'

// The one piece of state that has to cross a boundary Vue's own
// component tree can't bridge: AppHeader (global, mounted as a sibling of
// RouterView in App.vue) triggers the "Tu cuenta" sheet, but its actual
// content lives in DashboardView - not an ancestor AppHeader could reach
// with provide/inject.
export const useUiStore = defineStore('ui', {
  state: () => ({ accountSheetOpen: false }),

  actions: {
    openAccountSheet() {
      this.accountSheetOpen = true
    },
    closeAccountSheet() {
      this.accountSheetOpen = false
    },
  },
})
