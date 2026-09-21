<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Contraction } from '@/stores/babies'
import { LONG_GAP_MINUTES } from '@/lib/contractionStats'

// `now` is passed in (not read from `new Date()` internally) so the
// running row's live duration updates on the same tick as
// ContractionsView's own timer, instead of drifting out of sync with a
// second independent interval.
const props = defineProps<{ contractions: Contraction[]; dateLocale: string; now: Date }>()
defineEmits<{ edit: [id: number] }>()

const { t } = useI18n()

interface Row {
  contraction: Contraction
  number: number
  timeLabel: string
  durationLabel: string
  isRunning: boolean
  intervalLabel: string | null
  intervalAriaLabel: string | null
  showDaySeparator: boolean
  dayLabel: string
}

function formatDuration(totalSeconds: number): string {
  const clamped = Math.max(0, Math.round(totalSeconds))
  const minutes = Math.floor(clamped / 60)
  const seconds = clamped % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

// Newest-first, same order the store already keeps them in - the
// sequential number counts up from the oldest (1) to the newest, same
// as the reference app, so it's `total - index`, not `index + 1`. Day
// separators are grouped the same way as the exported PDF (see
// ContractionsExportController), walking newest-to-oldest and dropping a
// label each time the calendar day changes - `en-CA` gives a stable
// yyyy-mm-dd grouping key independent of `dateLocale`, which is only for
// display.
const rows = computed<Row[]>(() => {
  const total = props.contractions.length
  let previousDayKey: string | null = null

  return props.contractions.map((contraction, index) => {
    const startedAt = new Date(contraction.started_at)
    const endedAt = contraction.ended_at ? new Date(contraction.ended_at) : null
    const durationSeconds = ((endedAt ?? props.now).getTime() - startedAt.getTime()) / 1000

    // The next array entry is the *older* neighbor (list is newest-first).
    const olderNeighbor = props.contractions[index + 1]
    let intervalLabel: string | null = null
    let intervalAriaLabel: string | null = null
    if (olderNeighbor) {
      const olderEnd = olderNeighbor.ended_at
        ? new Date(olderNeighbor.ended_at)
        : new Date(olderNeighbor.started_at)
      const gapMinutes = (startedAt.getTime() - olderEnd.getTime()) / 60_000
      intervalLabel =
        gapMinutes > LONG_GAP_MINUTES
          ? t('contractions.longGap', { min: LONG_GAP_MINUTES })
          : formatDuration(gapMinutes * 60)
      intervalAriaLabel = t('contractions.interval', { interval: intervalLabel })
    }

    const dayKey = startedAt.toLocaleDateString('en-CA')
    const showDaySeparator = dayKey !== previousDayKey
    previousDayKey = dayKey

    return {
      contraction,
      number: total - index,
      timeLabel: startedAt.toLocaleTimeString(props.dateLocale, {
        hour: '2-digit',
        minute: '2-digit',
      }),
      durationLabel: formatDuration(durationSeconds),
      isRunning: endedAt === null,
      intervalLabel,
      intervalAriaLabel,
      showDaySeparator,
      dayLabel: startedAt.toLocaleDateString(props.dateLocale, {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
    }
  })
})
</script>

<template>
  <ul class="flex flex-col">
    <template v-for="(row, index) in rows" :key="row.contraction.id">
      <li v-if="row.showDaySeparator" class="my-4 flex items-center gap-3">
        <span class="h-px flex-1 bg-border"></span>
        <span
          class="shrink-0 rounded-full bg-surface-sunken px-4 py-1.5 text-sm font-bold text-brand"
        >
          {{ row.dayLabel }}
        </span>
        <span class="h-px flex-1 bg-border"></span>
      </li>

      <li class="flex gap-2.5">
        <div class="flex h-14 w-12 shrink-0 items-center justify-end pr-0.5">
          <span class="text-right text-base font-bold tabular-nums text-text-muted">
            {{ row.timeLabel }}
          </span>
        </div>

        <div class="flex flex-col items-center">
          <span
            class="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-sleep text-lg font-bold text-brand-ink"
          >
            {{ row.number }}
          </span>
          <span v-if="index < rows.length - 1" class="w-2 flex-1 rounded-full bg-border"></span>
        </div>

        <div class="min-w-0 flex-1 pb-2">
          <button
            type="button"
            class="flex h-14 w-full items-center gap-3 rounded-full border-2 px-4 text-left transition-colors"
            :class="
              row.isRunning
                ? 'border-brand bg-transparent'
                : 'border-transparent bg-surface-sunken hover:bg-surface'
            "
            @click="$emit('edit', row.contraction.id)"
          >
            <span
              class="text-base font-bold tabular-nums"
              :class="row.isRunning ? 'text-brand' : ''"
            >
              {{ row.durationLabel }}
            </span>

            <span class="ml-auto flex shrink-0 items-center gap-2">
              <span class="flex gap-1">
                <svg
                  v-for="bolt in 3"
                  :key="bolt"
                  viewBox="0 0 24 24"
                  :fill="bolt <= row.contraction.intensity + 1 ? 'currentColor' : 'none'"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  class="h-5 w-5"
                  :class="
                    bolt <= row.contraction.intensity + 1 ? 'text-milestone' : 'text-text-muted'
                  "
                >
                  <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" />
                </svg>
              </span>

              <svg viewBox="0 0 24 24" fill="currentColor" class="h-6 w-6 text-text-muted">
                <circle cx="12" cy="5" r="2" />
                <circle cx="12" cy="12" r="2" />
                <circle cx="12" cy="19" r="2" />
              </svg>
            </span>
          </button>

          <div v-if="row.intervalLabel" class="mt-2 flex justify-end">
            <span
              class="rounded-full border border-border px-4 py-1.5 text-base font-bold tabular-nums text-text-muted"
              :aria-label="row.intervalAriaLabel ?? undefined"
            >
              {{ row.intervalLabel }}
            </span>
          </div>
        </div>
      </li>
    </template>
  </ul>
</template>
