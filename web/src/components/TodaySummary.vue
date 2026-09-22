<script setup lang="ts">
import { computed, onUnmounted, reactive, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { categorySolidBg, type Category } from '@/lib/category'
import CategoryIcon from './CategoryIcon.vue'
import type { TimelineEntry } from '@/stores/babies'

const props = defineProps<{ timeline: TimelineEntry[]; enabledCategories: Category[] }>()

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

// Same "today" boundary as DailyRhythm (calendar day so far, not a
// rolling 24h window) - deliberately only feed/sleep/diaper have a
// meaningful daily count; growth/milestones are occasional events, not
// something a caregiver tracks "how many today".
const stats = computed<Stat[]>(() => {
  const now = new Date()
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  const end = new Date(now)
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
      label: t('dashboard.todaySummary.feed'),
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
    const hours = (minutes / 60).toFixed(1).replace(/\.0$/, '')
    result.push({
      category: 'sleep',
      raw: minutes,
      value: minutes > 0 ? `${hours}h` : '0h',
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
      label: t('dashboard.todaySummary.diaper'),
    })
  }

  return result
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

function formatSleep(minutes: number): string {
  const hours = (minutes / 60).toFixed(1).replace(/\.0$/, '')
  return minutes > 0 ? `${hours}h` : '0h'
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
})
</script>

<template>
  <div
    v-if="stats.length > 0"
    class="grid gap-2.5"
    :style="{ gridTemplateColumns: `repeat(${stats.length}, 1fr)` }"
  >
    <div
      v-for="stat in stats"
      :key="stat.category"
      class="card-interactive flex min-w-0 items-center gap-2.5 rounded-2xl p-3"
      :class="[categorySolidBg[stat.category], flashing[stat.category] && 'stat-card-flash']"
    >
      <span class="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/25 text-white">
        <CategoryIcon :category="stat.category" class="h-[1.05rem] w-[1.05rem]" />
      </span>
      <div class="min-w-0 leading-tight text-white">
        <div class="font-display text-xl font-bold tabular-nums">
          {{ displayValue[stat.category] ?? stat.value }}
        </div>
        <div class="truncate text-[0.68rem] font-semibold text-white/85">{{ stat.label }}</div>
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
