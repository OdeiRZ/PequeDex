<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { categorySolidBg, type Category } from '@/lib/category'
import CategoryIcon from './CategoryIcon.vue'
import type { TimelineEntry } from '@/stores/babies'

const props = defineProps<{ timeline: TimelineEntry[]; enabledCategories: Category[] }>()

const { t } = useI18n()

interface Stat {
  category: Category
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
    result.push({ category: 'feed', value: String(count), label: t('dashboard.todaySummary.feed') })
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
      value: String(count),
      label: t('dashboard.todaySummary.diaper'),
    })
  }

  return result
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
      :class="categorySolidBg[stat.category]"
    >
      <span class="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/25 text-white">
        <CategoryIcon :category="stat.category" class="h-[1.05rem] w-[1.05rem]" />
      </span>
      <div class="min-w-0 leading-tight text-white">
        <div class="font-display text-xl font-bold tabular-nums">{{ stat.value }}</div>
        <div class="truncate text-[0.68rem] font-semibold text-white/85">{{ stat.label }}</div>
      </div>
    </div>
  </div>
</template>
