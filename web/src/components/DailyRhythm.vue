<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { TimelineEntry } from '@/stores/babies'

const props = defineProps<{ timeline: TimelineEntry[]; dateLocale?: string }>()

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

// Only today's calendar day, not a rolling last-24h window - "ritmo de
// hoy" means the day so far, so it lines up with what a caregiver
// glancing at it would call "today". An ongoing sleep is clipped to
// "now" rather than extending into the empty rest of the day.
const rhythm = computed<RhythmData>(() => {
  const now = new Date()
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  const end = new Date(now)
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
      const at = new Date(entry.data.started_at)
      if (at >= start && at <= end) feedTicks.push({ left: toPercent(at), time: toTime(at) })
    } else if (entry.type === 'diaper_change') {
      const at = new Date(entry.data.changed_at)
      if (at >= start && at <= end) diaperTicks.push({ left: toPercent(at), time: toTime(at) })
    } else {
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
</script>

<template>
  <section class="card p-4">
    <div class="mb-1 flex items-baseline justify-between">
      <h2 class="font-display text-sm font-bold">{{ t('dashboard.rhythm.title') }}</h2>
      <span class="text-xs tabular-nums text-text-muted">{{ t('dashboard.rhythm.range') }}</span>
    </div>

    <template v-if="rhythm.hasData">
      <div class="relative my-3.5 h-7 rounded-full bg-surface-sunken">
        <span
          v-for="(seg, i) in rhythm.sleepSegments"
          :key="`sleep-${i}`"
          :title="`${t('dashboard.rhythm.sleep')} ${seg.time}`"
          class="absolute top-[3px] bottom-[3px] cursor-default rounded-full bg-sleep opacity-90 transition-[opacity,transform] duration-150 hover:z-10 hover:scale-y-125 hover:opacity-100"
          :style="{ left: `${seg.left}%`, width: `${seg.width}%` }"
        ></span>
        <span
          v-for="(tick, i) in rhythm.feedTicks"
          :key="`feed-${i}`"
          :title="`${t('dashboard.rhythm.feed')} ${tick.time}`"
          class="absolute top-[3px] bottom-[3px] w-[5px] cursor-default rounded-full bg-feed transition-transform duration-150 hover:z-10 hover:scale-125"
          :style="{ left: `${tick.left}%` }"
        ></span>
        <span
          v-for="(tick, i) in rhythm.diaperTicks"
          :key="`diaper-${i}`"
          :title="`${t('dashboard.rhythm.diaper')} ${tick.time}`"
          class="absolute top-[3px] bottom-[3px] w-[5px] cursor-default rounded-full bg-diaper transition-transform duration-150 hover:z-10 hover:scale-125"
          :style="{ left: `${tick.left}%` }"
        ></span>
      </div>
      <div class="mb-2.5 flex justify-between text-xs tabular-nums text-text-muted">
        <span>0h</span>
        <span>6h</span>
        <span>12h</span>
        <span>18h</span>
        <span>24h</span>
      </div>
      <div class="flex flex-wrap gap-3 text-xs text-text-muted">
        <span class="flex items-center gap-1.5"
          ><span class="h-2 w-2 rounded-full bg-feed"></span>{{ t('dashboard.rhythm.feed') }}</span
        >
        <span class="flex items-center gap-1.5"
          ><span class="h-2 w-2 rounded-full bg-sleep"></span
          >{{ t('dashboard.rhythm.sleep') }}</span
        >
        <span class="flex items-center gap-1.5"
          ><span class="h-2 w-2 rounded-full bg-diaper"></span
          >{{ t('dashboard.rhythm.diaper') }}</span
        >
      </div>
    </template>
    <p v-else class="py-2 text-center text-sm text-text-muted">
      {{ t('dashboard.rhythm.empty') }}
    </p>
  </section>
</template>
