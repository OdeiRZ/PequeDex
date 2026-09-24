<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import AppMark from '@/components/AppMark.vue'

const route = useRoute()
const { t } = useI18n()

// Deep link a caregiver already on a baby's profile can share ("Tu
// cuenta" > código de invitación) - if it's already in the URL when
// someone lands here, "Tengo una invitación" carries it straight into
// RegisterView's own field instead of making them retype it.
const inviteCode = computed(() =>
  typeof route.query.invite_code === 'string' ? route.query.invite_code : undefined,
)
</script>

<template>
  <main class="relative flex flex-1 flex-col overflow-hidden">
    <div
      class="animate-orb-drift pointer-events-none absolute -top-24 -left-28 h-[300px] w-[300px] rounded-full bg-[radial-gradient(circle_at_35%_30%,var(--brand)_0%,var(--brand-teal)_100%)] opacity-90 blur-[2px]"
    />
    <div
      class="animate-orb-drift-slow pointer-events-none absolute -right-36 bottom-10 h-[340px] w-[340px] rounded-full bg-[radial-gradient(circle_at_40%_35%,var(--brand-teal)_0%,var(--brand)_100%)] opacity-90 blur-[2px]"
    />
    <div
      class="animate-orb-drift-fast pointer-events-none absolute -left-12 bottom-[260px] h-[130px] w-[130px] rounded-full bg-[radial-gradient(circle_at_40%_35%,var(--brand)_0%,var(--brand-teal)_100%)] opacity-55 blur-[2px]"
    />
    <div
      class="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,color-mix(in_srgb,var(--color-bg)_15%,transparent)_0%,color-mix(in_srgb,var(--color-bg)_55%,transparent)_62%,var(--color-bg)_100%)]"
    />

    <div class="relative z-10 flex flex-1 flex-col px-5 pt-4 pb-10">
      <div class="flex justify-end">
        <RouterLink
          :to="{ name: 'login' }"
          class="rounded-full border border-border bg-surface/60 px-4 py-2 text-sm font-semibold backdrop-blur-sm"
        >
          {{ t('auth.welcome.loginPill') }}
        </RouterLink>
      </div>

      <div class="mt-10 flex items-center gap-2">
        <AppMark full :size="30" />
        <span class="font-display text-2xl font-bold">{{ t('app.name') }}</span>
      </div>

      <p class="mt-auto mb-9 max-w-[15ch] font-display text-[1.65rem] leading-tight font-semibold">
        {{ t('auth.welcome.tagline') }}
      </p>

      <div class="flex flex-col items-center gap-4">
        <RouterLink
          v-press
          :to="{ name: 'register' }"
          class="w-full rounded-full bg-gradient-to-br from-brand to-brand-teal py-4 text-center font-display font-bold text-brand-ink shadow-[0_14px_26px_-12px_color-mix(in_srgb,var(--brand)_60%,transparent)] transition-transform active:scale-[0.98]"
        >
          {{ t('auth.welcome.createAccount') }}
        </RouterLink>
        <RouterLink
          :to="{ name: 'register', query: inviteCode ? { invite_code: inviteCode } : {} }"
          class="text-sm font-semibold text-text-muted"
        >
          {{ t('auth.welcome.haveInvite') }}
        </RouterLink>
      </div>
    </div>
  </main>
</template>

<style scoped>
@keyframes orb-drift {
  0%,
  100% {
    transform: translate(0, 0) scale(1);
  }
  50% {
    transform: translate(14px, -16px) scale(1.04);
  }
}

.animate-orb-drift {
  animation: orb-drift 10s ease-in-out infinite;
}

.animate-orb-drift-slow {
  animation: orb-drift 12s ease-in-out infinite;
  animation-delay: -3s;
}

.animate-orb-drift-fast {
  animation: orb-drift 8s ease-in-out infinite;
  animation-delay: -1.5s;
}

@media (prefers-reduced-motion: reduce) {
  .animate-orb-drift,
  .animate-orb-drift-slow,
  .animate-orb-drift-fast {
    animation: none;
  }
}
</style>
