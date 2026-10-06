<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { GrowthMetricPoint } from '@/lib/stats'

const { t } = useI18n()

const props = defineProps<{
  points: GrowthMetricPoint[]
  unit: string
  dateLocale?: string
  /** 1 decimal for kg, 0 for cm - avoids a chart full of "52.0"/"53.0". */
  decimals: number
}>()

const WIDTH = 300
const HEIGHT = 110
const PAD_X = 8
const PAD_TOP = 14
const PAD_BOTTOM = 22

// A single point still draws as a dot (no line to speak of) - evenly
// spaced isn't meaningful for just one, so it sits centered.
const xPositions = computed<number[]>(() => {
  const { points } = props
  if (points.length <= 1) return points.map(() => WIDTH / 2)

  const firstPoint = points[0] as GrowthMetricPoint
  const lastPoint = points[points.length - 1] as GrowthMetricPoint
  const firstMs = new Date(firstPoint.date).getTime()
  const lastMs = new Date(lastPoint.date).getTime()
  const spanMs = lastMs - firstMs

  return points.map((p) => {
    if (spanMs === 0) return WIDTH / 2
    const fraction = (new Date(p.date).getTime() - firstMs) / spanMs
    return PAD_X + fraction * (WIDTH - PAD_X * 2)
  })
})

const valueRange = computed(() => {
  const values = props.points.map((p) => p.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  // A flat line (every reading identical) would divide by zero below -
  // a small fake span keeps it centered instead of crashing the scale.
  return { min, max: max > min ? max : min + 1 }
})

const yPositions = computed<number[]>(() => {
  const { min, max } = valueRange.value
  const drawable = HEIGHT - PAD_TOP - PAD_BOTTOM
  return props.points.map((p) => {
    const fraction = (p.value - min) / (max - min)
    return PAD_TOP + (1 - fraction) * drawable
  })
})

const linePath = computed(() => {
  const xs = xPositions.value
  const ys = yPositions.value
  if (xs.length < 2) return ''
  return xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x},${ys[i]}`).join(' ')
})

const areaPath = computed(() => {
  if (linePath.value === '') return ''
  const xs = xPositions.value
  const floorY = HEIGHT - PAD_BOTTOM
  const firstX = xs[0]
  const lastX = xs[xs.length - 1]
  return `${linePath.value} L${lastX},${floorY} L${firstX},${floorY} Z`
})

function formatValue(value: number): string {
  return `${value.toFixed(props.decimals)} ${props.unit}`
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString(props.dateLocale, { day: 'numeric', month: 'short' })
}

const chartLabel = computed(() => {
  const first = props.points[0]
  const latest = props.points[props.points.length - 1]
  if (!first || !latest) return ''
  if (first === latest)
    return t('stats.growth.chartLabelSingle', {
      value: formatValue(first.value),
      date: formatDate(first.date),
    })
  return t('stats.growth.chartLabelRange', {
    firstValue: formatValue(first.value),
    firstDate: formatDate(first.date),
    latestValue: formatValue(latest.value),
    latestDate: formatDate(latest.date),
  })
})
</script>

<template>
  <figure class="m-0">
    <svg
      :viewBox="`0 0 ${WIDTH} ${HEIGHT}`"
      class="w-full text-growth"
      role="img"
      :aria-label="chartLabel"
    >
      <path v-if="areaPath" :d="areaPath" fill="currentColor" opacity="0.12" stroke="none" />
      <path
        v-if="linePath"
        :d="linePath"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <circle
        v-for="(point, index) in points"
        :key="point.date"
        :cx="xPositions[index]"
        :cy="yPositions[index]"
        :r="index === points.length - 1 ? 3.5 : 2.5"
        fill="currentColor"
      />
      <text
        v-if="points.length > 0"
        :x="xPositions[0]"
        :y="HEIGHT - 6"
        font-size="9"
        fill="currentColor"
        opacity="0.6"
        text-anchor="start"
      >
        {{ formatDate((points[0] as GrowthMetricPoint).date) }}
      </text>
      <text
        v-if="points.length > 1"
        :x="xPositions[xPositions.length - 1]"
        :y="HEIGHT - 6"
        font-size="9"
        fill="currentColor"
        opacity="0.6"
        text-anchor="end"
      >
        {{ formatDate((points[points.length - 1] as GrowthMetricPoint).date) }}
      </text>
    </svg>
    <figcaption class="sr-only">{{ chartLabel }}</figcaption>
  </figure>
</template>
