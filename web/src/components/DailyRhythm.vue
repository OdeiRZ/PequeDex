<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { TimelineEntry } from '@/stores/babies'
import type { Category } from '@/lib/category'
import { parseDateOnly } from '@/lib/localDate'

const props = defineProps<{
  timeline: TimelineEntry[]
  dateLocale?: string
  enabledCategories: Category[]
  /** "YYYY-MM-DD", local calendar day being shown - the day navigator
   * in DashboardView.vue owns this, not the component itself, so a
   * baby switch or page reload can reset it back to today from one
   * place. */
  day: string
  isToday: boolean
}>()

defineEmits<{ prev: []; next: [] }>()

const { t } = useI18n()

const DAY_MS = 86_400_000

interface RhythmTick {
  left: number
  time: string
}

interface RhythmSegment {
  left: number
  width: number
  time: string
}

interface RhythmData {
  feedTicks: RhythmTick[]
  diaperTicks: RhythmTick[]
  sleepSegments: RhythmSegment[]
  hasData: boolean
}

const dayLabel = computed(() =>
  parseDateOnly(props.day).toLocaleDateString(props.dateLocale, {
    day: 'numeric',
    month: 'long',
  }),
)

const title = computed(() => (props.isToday ? t('dashboard.rhythm.title') : dayLabel.value))

// The shown day, not always today - browsing to a previous day (see
// DashboardView.vue's day navigator) reuses this exact same clamping
// logic unchanged, just against a different [start, end) window. An
// ongoing sleep still clips against the real "now" as its fallback
// end, same as before; `toPercent`'s own clamp already keeps that
// inside the shown day's bounds regardless of which day that is.
const rhythm = computed<RhythmData>(() => {
  const now = new Date()
  const start = parseDateOnly(props.day)
  const end = new Date(start)
  end.setHours(23, 59, 59, 999)

  const toPercent = (date: Date): number => {
    const clamped = Math.min(end.getTime(), Math.max(start.getTime(), date.getTime()))
    return ((clamped - start.getTime()) / DAY_MS) * 100
  }

  const toTime = (date: Date): string =>
    date.toLocaleTimeString(props.dateLocale, { hour: '2-digit', minute: '2-digit' })

  const feedTicks: RhythmTick[] = []
  const diaperTicks: RhythmTick[] = []
  const sleepSegments: RhythmSegment[] = []

  for (const entry of props.timeline) {
    if (entry.type === 'feed') {
      if (!props.enabledCategories.includes('feed')) continue
      const at = new Date(entry.data.started_at)
      if (at >= start && at <= end) feedTicks.push({ left: toPercent(at), time: toTime(at) })
    } else if (entry.type === 'diaper_change') {
      if (!props.enabledCategories.includes('diaper')) continue
      const at = new Date(entry.data.changed_at)
      if (at >= start && at <= end) diaperTicks.push({ left: toPercent(at), time: toTime(at) })
    } else {
      if (!props.enabledCategories.includes('sleep')) continue
      const segStart = new Date(entry.data.started_at)
      const segEnd = entry.data.ended_at ? new Date(entry.data.ended_at) : now
      if (segEnd < start || segStart > end) continue

      const left = toPercent(segStart)
      // A nap logged as a single instant would otherwise render as a
      // zero-width, invisible sliver - 1% keeps it visible as a mark.
      const width = Math.max(1, toPercent(segEnd) - left)
      const time = entry.data.ended_at ? `${toTime(segStart)}–${toTime(segEnd)}` : toTime(segStart)
      sleepSegments.push({ left, width, time })
    }
  }

  return {
    feedTicks,
    diaperTicks,
    sleepSegments,
    hasData: feedTicks.length > 0 || diaperTicks.length > 0 || sleepSegments.length > 0,
  }
})

// The exact time behind each mark used to live only in a `title`
// attribute - a hover-only native tooltip, unreachable by touch on the
// mobile-first majority of use. Marks are real `<button>`s now, and
// tapping one opens this same info in a small bubble instead; tapping
// the same mark again, a different mark, or anywhere else on the bar
// closes it. `left` is clamped away from the bar's own edges so the
// bubble never renders clipped by the card.
interface ActiveTick {
  label: string
  time: string
  left: number
}

const activeTick = ref<ActiveTick | null>(null)

function toggleTick(next: ActiveTick) {
  activeTick.value =
    activeTick.value?.label === next.label && activeTick.value.time === next.time
      ? null
      : { ...next, left: Math.min(92, Math.max(8, next.left)) }
}

watch(
  () => props.day,
  () => {
    activeTick.value = null
  },
)
</script>

<template>
  <section class="card p-4">
    <div class="mb-1 flex items-center justify-between gap-2">
      <button
        type="button"
        class="grid h-7 w-7 shrink-0 place-items-center rounded-full text-text-muted transition-colors hover:text-text active:text-text"
        :aria-label="t('dashboard.rhythm.prevDay')"
        @click="$emit('prev')"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="h-4 w-4"
        >
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </button>
      <h2 class="min-w-0 flex-1 truncate text-center font-display text-sm font-bold">
        {{ title }}
      </h2>
      <button
        type="button"
        :disabled="isToday"
        class="grid h-7 w-7 shrink-0 place-items-center rounded-full text-text-muted transition-colors hover:text-text active:text-text disabled:opacity-30"
        :aria-label="t('dashboard.rhythm.nextDay')"
        @click="$emit('next')"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="h-4 w-4"
        >
          <path d="M9 18l6-6-6-6" />
        </svg>
      </button>
    </div>

    <template v-if="rhythm.hasData">
      <div class="relative my-3.5 h-7 rounded-full bg-surface-sunken" @click="activeTick = null">
        <button
          v-for="(seg, i) in rhythm.sleepSegments"
          :key="`sleep-${i}`"
          type="button"
          :title="`${t('dashboard.rhythm.sleep')} ${seg.time}`"
          :aria-label="`${t('dashboard.rhythm.sleep')} ${seg.time}`"
          class="absolute top-[3px] bottom-[3px] rounded-full bg-sleep opacity-90 transition-[opacity,transform] duration-150 hover:z-10 hover:scale-y-125 hover:opacity-100 active:z-10 active:scale-y-125 active:opacity-100"
          :style="{ left: `${seg.left}%`, width: `${seg.width}%` }"
          @click.stop="
            toggleTick({ label: t('dashboard.rhythm.sleep'), time: seg.time, left: seg.left })
          "
        ></button>
        <button
          v-for="(tick, i) in rhythm.feedTicks"
          :key="`feed-${i}`"
          type="button"
          :title="`${t('dashboard.rhythm.feed')} ${tick.time}`"
          :aria-label="`${t('dashboard.rhythm.feed')} ${tick.time}`"
          class="absolute top-[3px] bottom-[3px] w-[5px] -translate-x-1/2 rounded-full bg-feed transition-transform duration-150 hover:z-10 hover:scale-125 active:z-10 active:scale-125"
          :style="{ left: `${tick.left}%` }"
          @click.stop="
            toggleTick({ label: t('dashboard.rhythm.feed'), time: tick.time, left: tick.left })
          "
        ></button>
        <button
          v-for="(tick, i) in rhythm.diaperTicks"
          :key="`diaper-${i}`"
          type="button"
          :title="`${t('dashboard.rhythm.diaper')} ${tick.time}`"
          :aria-label="`${t('dashboard.rhythm.diaper')} ${tick.time}`"
          class="absolute top-[3px] bottom-[3px] w-[5px] -translate-x-1/2 rounded-full bg-diaper transition-transform duration-150 hover:z-10 hover:scale-125 active:z-10 active:scale-125"
          :style="{ left: `${tick.left}%` }"
          @click.stop="
            toggleTick({ label: t('dashboard.rhythm.diaper'), time: tick.time, left: tick.left })
          "
        ></button>

        <div
          v-if="activeTick"
          class="pointer-events-none absolute -top-8 -translate-x-1/2 rounded-full bg-text px-2.5 py-1 text-xs font-semibold whitespace-nowrap text-bg shadow-md"
          :style="{ left: `${activeTick.left}%` }"
        >
          {{ activeTick.label }} {{ activeTick.time }}
        </div>
      </div>
      <div class="relative mb-2.5 h-4 text-xs tabular-nums text-text-muted">
        <span class="absolute left-0">0h</span>
        <span class="absolute left-1/4 -translate-x-1/2">6h</span>
        <span class="absolute left-1/2 -translate-x-1/2">12h</span>
        <span class="absolute left-3/4 -translate-x-1/2">18h</span>
        <span class="absolute right-0">24h</span>
      </div>
      <div class="flex flex-wrap gap-3 text-xs text-text-muted">
        <span v-if="enabledCategories.includes('feed')" class="flex items-center gap-1.5"
          ><span class="h-2 w-2 rounded-full bg-feed"></span>{{ t('dashboard.rhythm.feed') }}</span
        >
        <span v-if="enabledCategories.includes('sleep')" class="flex items-center gap-1.5"
          ><span class="h-2 w-2 rounded-full bg-sleep"></span
          >{{ t('dashboard.rhythm.sleep') }}</span
        >
        <span v-if="enabledCategories.includes('diaper')" class="flex items-center gap-1.5"
          ><span class="h-2 w-2 rounded-full bg-diaper"></span
          >{{ t('dashboard.rhythm.diaper') }}</span
        >
      </div>
    </template>
    <p v-else class="py-2 text-center text-sm text-text-muted">
      {{ isToday ? t('dashboard.rhythm.empty') : t('dashboard.rhythm.emptyOtherDay') }}
    </p>
  </section>
</template>
