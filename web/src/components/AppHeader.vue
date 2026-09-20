<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import { useToastStore } from '@/stores/toast'
import { useUiStore } from '@/stores/ui'
import AppMark from './AppMark.vue'
import ThemeToggle from './ThemeToggle.vue'
import UserAvatar from './UserAvatar.vue'

const router = useRouter()
const auth = useAuthStore()
const ui = useUiStore()
const toast = useToastStore()
const { t } = useI18n()

async function onLogout() {
  await auth.logout()
  router.push({ name: 'login' })
}

// A little celebration on the header mark whenever something is saved
// successfully - same "toggle off, then rAF back on" trick as LudoDex's
// dice-roll icon, so the animation replays even on back-to-back saves
// where the class itself never actually left the element.
const celebrating = ref(false)

watch(
  () => (toast.type === 'success' ? toast.key : null),
  (key) => {
    if (key === null) return
    celebrating.value = false
    requestAnimationFrame(() => {
      celebrating.value = true
    })
  },
)
</script>

<template>
  <header
    class="sticky top-0 z-20 flex items-center justify-between gap-2 border-b border-border bg-bg px-4 py-3"
  >
    <span class="flex items-center gap-1.5 font-display text-xl font-bold">
      <span
        class="origin-center [transform-box:fill-box]"
        :class="{ 'motion-safe:animate-mark-pop': celebrating }"
        @animationend="celebrating = false"
      >
        <AppMark full :size="24" />
      </span>
      PequeDex
    </span>

    <div class="flex shrink-0 items-center gap-2">
      <ThemeToggle />
      <button
        v-if="auth.user"
        type="button"
        :aria-label="t('profile.title')"
        @click="ui.openAccountSheet()"
      >
        <UserAvatar :name="auth.user.name" :avatar="auth.user.avatar" :size="28" />
      </button>
      <button
        v-if="auth.user"
        type="button"
        class="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-border bg-surface text-text-muted"
        :aria-label="t('common.logout')"
        @click="onLogout"
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
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <path d="M16 17l5-5-5-5M21 12H9" />
        </svg>
      </button>
    </div>
  </header>
</template>
