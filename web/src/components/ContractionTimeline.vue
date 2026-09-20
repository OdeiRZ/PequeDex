<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Contraction } from '@/stores/babies'

// `now` is passed in (not read from `new Date()` internally) so the
// running row's live duration updates on the same tick as
// ContractionsView's own timer, instead of drifting out of sync with a
// second independent interval.
const props = defineProps<{ contractions: Contraction[]; dateLocale: string; now: Date }>()
defineEmits<{ edit: [id: number] }>()

const { t } = useI18n()

const LONG_GAP_MINUTES = 50

interface Row {
  contraction: Contraction
  number: number
  durationLabel: string
  isRunning: boolean
  intervalLabel: string | null
}

function formatDuration(totalSeconds: number): string {
  const clamped = Math.max(0, Math.round(totalSeconds))
  const minutes = Math.floor(clamped / 60)
  const seconds = clamped % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

// Newest-first, same order the store already keeps them in - the
// sequential number counts up from the oldest (1) to the newest, same
// as the reference app, so it's `total - index`, not `index + 1`.
const rows = computed<Row[]>(() => {
  const total = props.contractions.length

  return props.contractions.map((contraction, index) => {
    const startedAt = new Date(contraction.started_at)
    const endedAt = contraction.ended_at ? new Date(contraction.ended_at) : null
    const durationSeconds = ((endedAt ?? props.now).getTime() - startedAt.getTime()) / 1000

    // The next array entry is the *older* neighbor (list is newest-first).
    const olderNeighbor = props.contractions[index + 1]
    let intervalLabel: string | null = null
    if (olderNeighbor) {
      const olderEnd = olderNeighbor.ended_at
        ? new Date(olderNeighbor.ended_at)
        : new Date(olderNeighbor.started_at)
      const gapMinutes = (startedAt.getTime() - olderEnd.getTime()) / 60_000
      intervalLabel =
        gapMinutes > LONG_GAP_MINUTES
          ? t('contractions.longGap', { min: LONG_GAP_MINUTES })
          : formatDuration(gapMinutes * 60)
    }

    return {
      contraction,
      number: total - index,
      durationLabel: formatDuration(durationSeconds),
      isRunning: endedAt === null,
      intervalLabel,
    }
  })
})
</script>

<template>
  <ul class="flex flex-col">
    <li v-for="(row, index) in rows" :key="row.contraction.id" class="flex gap-3">
      <div class="flex flex-col items-center">
        <span
          class="grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold text-brand-ink"
          :class="row.isRunning ? 'bg-brand' : 'bg-sleep'"
        >
          {{ row.number }}
        </span>
        <span v-if="index < rows.length - 1" class="w-px flex-1 bg-border"></span>
      </div>

      <div class="min-w-0 flex-1 pb-4">
        <button
          type="button"
          class="card-interactive flex w-full items-center gap-3 rounded-2xl p-3 text-left ring-2 ring-transparent"
          :class="row.isRunning ? 'ring-brand' : ''"
          @click="$emit('edit', row.contraction.id)"
        >
          <span class="text-sm font-semibold tabular-nums text-text-muted">
            {{
              new Date(row.contraction.started_at).toLocaleTimeString(dateLocale, {
                hour: '2-digit',
                minute: '2-digit',
              })
            }}
          </span>
          <span
            class="flex-1 text-right font-display text-sm font-bold tabular-nums"
            :class="row.isRunning ? 'text-brand' : ''"
          >
            {{ row.durationLabel }}
          </span>
          <span class="flex shrink-0 gap-0.5">
            <svg
              v-for="bolt in 3"
              :key="bolt"
              viewBox="0 0 24 24"
              :fill="bolt <= row.contraction.intensity + 1 ? 'currentColor' : 'none'"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="h-3.5 w-3.5"
              :class="bolt <= row.contraction.intensity + 1 ? 'text-milestone' : 'text-border'"
            >
              <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" />
            </svg>
          </span>
        </button>

        <p v-if="row.intervalLabel" class="mt-1 pl-1 text-xs text-text-muted">
          {{ t('contractions.interval', { interval: row.intervalLabel }) }}
        </p>
      </div>
    </li>
  </ul>
</template>
