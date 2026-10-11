<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { DailyAlert } from '@/lib/dailyAlerts'

// Avisos suaves (ver lib/dailyAlerts.ts): tono informativo, no de
// alarma - mismo color "warning" que el recordatorio de vitamina D, no
// el rojo de error. Cada uno se puede ocultar hasta mañana.
defineProps<{ alerts: DailyAlert[] }>()
const emit = defineEmits<{ dismiss: [key: DailyAlert['key']] }>()

const { t } = useI18n()

function message(alert: DailyAlert): string {
  if (alert.key === 'noPoop') {
    return alert.atLeast
      ? t('dashboard.alerts.noPoopAtLeast', { days: alert.days })
      : t('dashboard.alerts.noPoop', { days: alert.days })
  }
  return t('dashboard.alerts.fewWet', { count: alert.count }, alert.count)
}

function hint(alert: DailyAlert): string {
  return alert.key === 'noPoop'
    ? t('dashboard.alerts.noPoopHint')
    : t('dashboard.alerts.fewWetHint')
}
</script>

<template>
  <section
    class="flex flex-col gap-2 rounded-2xl border border-warning/40 bg-warning/10 p-3"
    role="status"
  >
    <div v-for="alert in alerts" :key="alert.key" class="flex items-start gap-2.5">
      <span
        class="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-warning/20 text-warning"
        aria-hidden="true"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="h-4 w-4"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v5M12 16.5v.01" />
        </svg>
      </span>
      <div class="min-w-0 flex-1">
        <div class="text-sm font-semibold">{{ message(alert) }}</div>
        <div class="text-xs text-text-muted">{{ hint(alert) }}</div>
      </div>
      <button
        type="button"
        class="shrink-0 self-center border-0 p-0 text-xs font-semibold leading-none text-text-muted underline"
        @click="emit('dismiss', alert.key)"
      >
        {{ t('dashboard.alerts.dismiss') }}
      </button>
    </div>
  </section>
</template>
