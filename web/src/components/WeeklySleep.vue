<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { summarizeSleepByDay } from '@/lib/sleepHistory'
import type { Sleep } from '@/stores/babies'

const props = defineProps<{ sleeps: Sleep[]; dateLocale: string }>()

const { t } = useI18n()

const DAYS = 7

const days = computed(() => summarizeSleepByDay(props.sleeps, DAYS))

const hasData = computed(() => days.value.some((day) => day.hours > 0))

// Scaled against the week's own busiest day, floored at 8h so a quiet
// week's bars don't all read as artificially "full" against a tiny
// self-referential ceiling.
const scaleMax = computed(() => Math.max(8, ...days.value.map((day) => day.hours)))

function barHeightPercent(hours: number): number {
  return Math.max(4, (hours / scaleMax.value) * 100)
}

function parseDateKey(dateKey: string): Date {
  const parts = dateKey.split('-')
  return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]))
}

function dayLabel(dateKey: string): string {
  return parseDateKey(dateKey).toLocaleDateString(props.dateLocale, { weekday: 'short' })
}

function isToday(dateKey: string): boolean {
  const now = new Date()
  const date = parseDateKey(dateKey)
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  )
}

function hoursLabel(hours: number): string {
  return hours > 0 ? `${hours.toFixed(1)} h` : ''
}
</script>

<template>
  <section class="card p-4">
    <h2 class="mb-3 font-display text-sm font-bold">{{ t('dashboard.sleepHistory.title') }}</h2>

    <template v-if="hasData">
      <div class="flex h-24 items-end justify-between gap-2">
        <div
          v-for="day in days"
          :key="day.date"
          class="flex h-full flex-1 flex-col items-center justify-end gap-1"
        >
          <span class="text-[0.6rem] tabular-nums text-text-muted">{{
            hoursLabel(day.hours)
          }}</span>
          <div class="flex w-full flex-1 items-end">
            <div
              class="w-full rounded-md bg-sleep transition-all"
              :style="{ height: `${barHeightPercent(day.hours)}%` }"
            ></div>
          </div>
          <span
            class="text-[0.62rem] capitalize"
            :class="isToday(day.date) ? 'font-bold text-text' : 'text-text-muted'"
          >
            {{ dayLabel(day.date) }}
          </span>
        </div>
      </div>
    </template>
    <p v-else class="py-2 text-center text-sm text-text-muted">
      {{ t('dashboard.sleepHistory.empty') }}
    </p>
  </section>
</template>
