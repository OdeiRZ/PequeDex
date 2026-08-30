<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { applyTheme, getStoredTheme, storeTheme } from '@/theme'

const { t } = useI18n()

const isDark = ref(resolvesToDark())

function resolvesToDark(): boolean {
  const stored = getStoredTheme()
  if (stored === 'light') return false
  if (stored === 'dark') return true
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

function toggle() {
  const next = isDark.value ? 'light' : 'dark'
  storeTheme(next)
  applyTheme(next)
  isDark.value = next === 'dark'
}
</script>

<template>
  <button
    type="button"
    class="grid h-8 w-8 place-items-center rounded-full border border-border bg-surface text-text-muted"
    :aria-label="t('common.toggleTheme')"
    @click="toggle"
  >
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      class="h-[1.05rem] w-[1.05rem]"
    >
      <!-- Shows the mode a click leads to, not the current one - in dark
      mode the button switches to light, so it shows the sun (and vice
      versa), same convention as LudoDex/MIRA MarketLens's toggle. -->
      <template v-if="isDark">
        <circle cx="12" cy="12" r="4" />
        <path
          d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"
        />
      </template>
      <path v-else d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
    </svg>
  </button>
</template>
