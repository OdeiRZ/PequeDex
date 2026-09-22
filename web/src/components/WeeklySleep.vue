<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { summarizeSleepByDay } from '@/lib/sleepHistory'
import type { Sleep } from '@/stores/babies'

const props = defineProps<{ sleeps: Sleep[]; dateLocale: string }>()

const { t } = useI18n()

// Bars start pinned at the floor height and only grow to their real
// height one animation frame after mount - setting the real height
// straight away on the very first render would leave nothing for the
// `transition: height` below to actually animate from, so the week
// would just appear already-drawn instead of growing in. A later
// change to `sleeps` (a new nap logged while the dashboard is open)
// still animates on its own, since `grown` stays true and the
// transition is always active - this ref is only about the very first
// paint.
const grown = ref(false)

onMounted(() => {
  requestAnimationFrame(() => {
    grown.value = true
  })
})

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
          v-for="(day, index) in days"
          :key="day.date"
          class="group flex h-full flex-1 flex-col items-center justify-end gap-1"
        >
          <span
            class="text-[0.6rem] tabular-nums text-text-muted transition-[color,transform] duration-150 group-hover:scale-110 group-hover:text-sleep group-hover:font-bold"
          >
            {{ hoursLabel(day.hours) }}
          </span>
          <div class="flex w-full flex-1 items-end">
            <div
              class="bar-grow w-full origin-bottom rounded-md bg-sleep group-hover:scale-x-110 group-hover:brightness-110"
              :class="
                isToday(day.date) ? 'ring-2 ring-sleep/50 ring-offset-1 ring-offset-surface' : ''
              "
              :style="{
                height: `${grown ? barHeightPercent(day.hours) : 4}%`,
                transitionDelay: `${index * 70}ms`,
              }"
            ></div>
          </div>
          <span
            class="text-[0.62rem] capitalize transition-colors duration-150"
            :class="
              isToday(day.date) ? 'font-bold text-sleep' : 'text-text-muted group-hover:text-text'
            "
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

<style scoped>
.bar-grow {
  transition:
    height 0.55s cubic-bezier(0.34, 1.56, 0.64, 1),
    transform 0.15s ease-out,
    filter 0.15s ease-out;
}

@media (prefers-reduced-motion: reduce) {
  .bar-grow {
    transition: none;
  }
}
</style>
