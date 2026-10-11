<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useFeedback } from '@/composables/useFeedback'
import type { UpcomingItem } from '@/lib/vaccinations'

// Enlace a /vacunas, mismo formato que StatsLinkCard.vue. Cuando hay una
// vacuna o revisión en los próximos días (o una vacuna atrasada), la
// tarjeta lo dice y se tiñe del tono "warning" del recordatorio de
// vitamina D; si no, solo resume cuántas van puestas.
const props = defineProps<{
  upcoming: UpcomingItem | null
  given: number
  total: number
  dateLocale: string
}>()

const { t } = useI18n()
const feedback = useFeedback()

const subtitle = computed(() => {
  const item = props.upcoming
  if (!item) return t('vaccinations.linkCard.progress', { given: props.given, total: props.total })

  const when = item.date.toLocaleDateString(props.dateLocale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
  if (item.kind === 'checkup') {
    const time = item.date.toLocaleTimeString(props.dateLocale, {
      hour: '2-digit',
      minute: '2-digit',
    })
    return t('vaccinations.linkCard.checkup', {
      reason: item.reason || t('vaccinations.checkups.defaultReason'),
      when: `${when}, ${time}`,
    })
  }
  return t(item.overdue ? 'vaccinations.linkCard.overdue' : 'vaccinations.linkCard.vaccines', {
    names: item.names.join(', '),
    when,
  })
})
</script>

<template>
  <RouterLink
    :to="{ name: 'vaccinations' }"
    class="card-interactive flex items-center gap-3 rounded-2xl p-4"
    :class="upcoming && 'border border-warning/40 bg-warning/10'"
    @click="feedback.nav()"
  >
    <span
      class="grid h-10 w-10 shrink-0 place-items-center rounded-full"
      :class="upcoming ? 'bg-warning/20 text-warning' : 'bg-growth/15 text-growth'"
    >
      <!-- Jeringa -->
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="h-5 w-5"
      >
        <path
          d="m18 2 4 4M17 7l3-3M19 9 8.7 19.3a2.4 2.4 0 0 1-3.4 0l-.6-.6a2.4 2.4 0 0 1 0-3.4L15 5"
        />
        <path d="m9 11 4 4M5 19l-3 3M14 4l6 6" />
      </svg>
    </span>
    <div class="min-w-0 flex-1">
      <div class="text-sm font-semibold">{{ t('vaccinations.title') }}</div>
      <div class="text-xs text-text-muted">{{ subtitle }}</div>
    </div>
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      class="h-4 w-4 shrink-0 text-text-muted"
    >
      <path d="M9 18l6-6-6-6" />
    </svg>
  </RouterLink>
</template>
