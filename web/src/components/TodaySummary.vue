<script setup lang="ts">
import { computed, onUnmounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { categoryStrongBg, type Category } from '@/lib/category'
import { parseDateOnly, todayDateOnlyString } from '@/lib/localDate'
import { formatMinutesShort } from '@/lib/sleepReference'
import { formatHoursShort } from '@/lib/formatNumber'
import CategoryIcon from './CategoryIcon.vue'
import type { TimelineEntry } from '@/stores/babies'

const props = defineProps<{
  timeline: TimelineEntry[]
  enabledCategories: Category[]
  /** "YYYY-MM-DD", local calendar day to summarize - same day navigator
   * DailyRhythm.vue already reads from DashboardView.vue, so browsing to
   * a previous day recalculates these cards too instead of always
   * showing today's counts regardless of which day is on screen. */
  day: string
}>()

const { t } = useI18n()

interface Stat {
  category: Category
  /** The magnitude to actually tween between - a plain count for
   * feed/diaper, minutes (not hours) for sleep, so the count-up below
   * has something numeric to animate even though sleep's own label
   * isn't a bare integer. */
  raw: number
  value: string
  label: string
}

// Same calendar-day boundary as DailyRhythm (not a rolling 24h window),
// against whichever day `props.day` names - deliberately only
// feed/sleep/diaper have a meaningful daily count; growth/milestones
// are occasional events, not something a caregiver tracks "how many
// today". `now` still stands in for an ongoing sleep's missing
// `ended_at` (same as DailyRhythm) - the surrounding clip against
// `[start, end]` naturally caps it at the shown day's own end when
// that's a past day.
const stats = computed<Stat[]>(() => {
  const now = new Date()
  const start = parseDateOnly(props.day)
  const end = new Date(start)
  end.setHours(23, 59, 59, 999)
  const within = (date: Date) => date >= start && date <= end

  const result: Stat[] = []

  if (props.enabledCategories.includes('feed')) {
    const count = props.timeline.filter(
      (e) => e.type === 'feed' && within(new Date(e.data.started_at)),
    ).length
    result.push({
      category: 'feed',
      raw: count,
      value: String(count),
      label: t('dashboard.todaySummary.feed', count),
    })
  }

  if (props.enabledCategories.includes('sleep')) {
    let minutes = 0
    for (const e of props.timeline) {
      if (e.type !== 'sleep') continue
      const segStart = new Date(e.data.started_at)
      const segEnd = e.data.ended_at ? new Date(e.data.ended_at) : now
      const clippedStart = segStart < start ? start : segStart
      const clippedEnd = segEnd > end ? end : segEnd
      if (clippedEnd > clippedStart) {
        minutes += (clippedEnd.getTime() - clippedStart.getTime()) / 60_000
      }
    }
    result.push({
      category: 'sleep',
      raw: minutes,
      value: formatSleep(minutes),
      label: t('dashboard.todaySummary.sleep'),
    })
  }

  if (props.enabledCategories.includes('diaper')) {
    const count = props.timeline.filter(
      (e) => e.type === 'diaper_change' && within(new Date(e.data.changed_at)),
    ).length
    result.push({
      category: 'diaper',
      raw: count,
      value: String(count),
      label: t('dashboard.todaySummary.diaper', count),
    })
  }

  return result
})

// "Hace cuánto" bajo cada cifra: lo que se pregunta de madrugada ("¿cuándo
// comió?") sin bajar a la línea temporal. Solo para el día de hoy (navegando
// un día pasado no tiene sentido) y sobre lo más reciente de toda la línea
// temporal, aunque fuera ayer. El reloj avanza cada 30 s; con la app oculta el
// navegador ya frena el temporizador.
const clock = ref(Date.now())
const clockTimer = setInterval(() => (clock.value = Date.now()), 30_000)

const isToday = computed(() => {
  void clock.value
  return props.day === todayDateOnlyString()
})

function ago(fromIso: string): string {
  return formatMinutesShort(Math.max(0, (clock.value - new Date(fromIso).getTime()) / 60_000))
}

const sinceLabel = computed<Partial<Record<Category, string>>>(() => {
  if (!isToday.value) return {}
  const labels: Partial<Record<Category, string>> = {}
  // La línea temporal llega de más reciente a más antigua.
  const lastFeed = props.timeline.find((e) => e.type === 'feed')
  if (lastFeed?.type === 'feed') {
    labels.feed = t('dashboard.todaySummary.since.feed', { time: ago(lastFeed.data.started_at) })
  }
  const lastSleep = props.timeline.find((e) => e.type === 'sleep')
  if (lastSleep?.type === 'sleep') {
    labels.sleep = lastSleep.data.ended_at
      ? t('dashboard.todaySummary.since.sleep', { time: ago(lastSleep.data.ended_at) })
      : t('dashboard.todaySummary.since.sleepOngoing', { time: ago(lastSleep.data.started_at) })
  }
  const lastDiaper = props.timeline.find((e) => e.type === 'diaper_change')
  if (lastDiaper?.type === 'diaper_change') {
    labels.diaper = t('dashboard.todaySummary.since.diaper', {
      time: ago(lastDiaper.data.changed_at),
    })
  }
  return labels
})

// Counts up to a changed value instead of snapping to it, and flashes
// the card that changed - otherwise every card looks the same whether
// it's the one that just got a new entry or one that didn't. Keyed by
// category so each card's own tween runs independently; a category
// still mid-tween when it changes again just retargets instead of
// stacking two rAF loops. Skips both on first render (nothing "changed"
// yet, there's no earlier value to animate from) and whenever `raw`
// hasn't actually moved (e.g. switching enabled categories reshuffles
// the array without any real count changing).
const displayValue = reactive<Partial<Record<Category, string>>>({})
const flashing = reactive<Partial<Record<Category, boolean>>>({})
const tweenFrames = new Map<Category, number>()
const flashTimers = new Map<Category, ReturnType<typeof setTimeout>>()

// "3,9 h" en español, "3.9 h" en inglés (formatHoursShort).
function formatSleep(minutes: number): string {
  return formatHoursShort(Math.round((minutes / 60) * 10) / 10)
}

function animateStat(stat: Stat, fromRaw: number) {
  const existingFrame = tweenFrames.get(stat.category)
  if (existingFrame !== undefined) cancelAnimationFrame(existingFrame)

  const start = performance.now()
  const duration = 400

  function tick(now: number) {
    const progress = Math.min(1, (now - start) / duration)
    const current = fromRaw + (stat.raw - fromRaw) * progress
    displayValue[stat.category] =
      stat.category === 'sleep' ? formatSleep(current) : String(Math.round(current))

    if (progress < 1) {
      tweenFrames.set(stat.category, requestAnimationFrame(tick))
    } else {
      displayValue[stat.category] = stat.value
      tweenFrames.delete(stat.category)
    }
  }

  tweenFrames.set(stat.category, requestAnimationFrame(tick))

  clearTimeout(flashTimers.get(stat.category))
  flashing[stat.category] = false
  requestAnimationFrame(() => {
    flashing[stat.category] = true
    flashTimers.set(
      stat.category,
      setTimeout(() => {
        flashing[stat.category] = false
      }, 700),
    )
  })
}

watch(
  stats,
  (newStats, oldStats) => {
    const previousByCategory = new Map((oldStats ?? []).map((s) => [s.category, s]))

    for (const stat of newStats) {
      const previous = previousByCategory.get(stat.category)

      if (!previous) {
        displayValue[stat.category] = stat.value
      } else if (previous.raw !== stat.raw) {
        animateStat(stat, previous.raw)
      }
    }
  },
  { immediate: true },
)

onUnmounted(() => {
  for (const frame of tweenFrames.values()) cancelAnimationFrame(frame)
  for (const timer of flashTimers.values()) clearTimeout(timer)
  clearInterval(clockTimer)
})
</script>

<template>
  <div
    v-if="stats.length > 0"
    class="grid gap-2"
    :style="{ gridTemplateColumns: `repeat(${stats.length}, 1fr)` }"
  >
    <div
      v-for="stat in stats"
      :key="stat.category"
      class="card-interactive flex min-w-0 flex-col gap-1 rounded-2xl p-2.5 text-white"
      :class="[categoryStrongBg[stat.category], flashing[stat.category] && 'stat-card-flash']"
    >
      <!-- Arriba el icono en su círculo y la cifra en grande; debajo, a todo el
           ancho de la tarjeta, la etiqueta y el "hace…". Con la cifra al lado
           de un círculo que crecía ("10,7 h"), el texto se quedaba sin sitio y
           se partía palabra a palabra. -->
      <div class="flex min-w-0 items-center gap-1.5">
        <span class="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/25">
          <CategoryIcon :category="stat.category" class="h-[0.9rem] w-[0.9rem]" />
        </span>
        <span
          class="min-w-0 truncate font-display text-lg leading-none font-bold tabular-nums"
          data-testid="summary-value"
        >
          {{ displayValue[stat.category] ?? stat.value }}
        </span>
      </div>
      <div class="min-w-0 leading-tight">
        <div class="text-[0.68rem] font-semibold">{{ stat.label }}</div>
        <div v-if="sinceLabel[stat.category]" class="text-[0.62rem]">
          {{ sinceLabel[stat.category] }}
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.stat-card-flash {
  animation: stat-card-flash 0.7s ease;
}

@keyframes stat-card-flash {
  0% {
    box-shadow: 0 0 0 0 rgb(255 255 255 / 0.7);
  }
  100% {
    box-shadow: 0 0 0 10px rgb(255 255 255 / 0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .stat-card-flash {
    animation: none;
  }
}
</style>
