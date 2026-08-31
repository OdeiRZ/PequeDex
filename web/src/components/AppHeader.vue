<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import { useBabiesStore } from '@/stores/babies'
import { useUiStore } from '@/stores/ui'
import ThemeToggle from './ThemeToggle.vue'
import UserAvatar from './UserAvatar.vue'

const router = useRouter()
const auth = useAuthStore()
const babies = useBabiesStore()
const ui = useUiStore()
const { t } = useI18n()

async function onLogout() {
  await auth.logout()
  router.push({ name: 'login' })
}
</script>

<template>
  <header
    class="sticky top-0 z-20 flex items-center justify-between gap-2 border-b border-border bg-bg px-4 py-3"
  >
    <!-- Full wordmark pre-login/onboarding, where there's no account or
    baby yet to show instead. Once both exist, day-to-day it matters more
    which caregiver/baby this is than the app's own name, so the account
    button takes that space and the logo shrinks to just the emoji. -->
    <button
      v-if="auth.user && babies.current"
      type="button"
      class="flex min-w-0 items-center gap-2 font-semibold"
      @click="ui.openAccountSheet()"
    >
      <span aria-hidden="true" class="shrink-0 text-xl">👶</span>
      <UserAvatar :name="auth.user.name" :avatar="auth.user.avatar" :size="28" />
      <span class="truncate">{{ auth.user.name }}</span>
    </button>
    <span v-else class="flex items-center gap-1.5 font-display text-xl font-bold">
      <span aria-hidden="true">👶</span>
      PequeDex
    </span>

    <div class="flex shrink-0 items-center gap-2">
      <button
        v-if="auth.user && babies.current"
        type="button"
        class="grid h-8 w-8 place-items-center rounded-full border border-border bg-surface text-text-muted"
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
      <ThemeToggle />
    </div>
  </header>
</template>
