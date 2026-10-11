<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { GrowthMetricPoint } from '@/lib/stats'
import { referenceSamples, type GrowthReferenceRow } from '@/lib/growthReference'

const { t } = useI18n()

const props = defineProps<{
  points: GrowthMetricPoint[]
  unit: string
  dateLocale?: string
  /** 1 decimal for kg, 0 for cm - avoids a chart full of "52.0"/"53.0". */
  decimals: number
  /** Curvas de la OMS para esta medida (bandas detrás de la línea); sin
   * ellas, o sin fecha de nacimiento, la gráfica sale como siempre. */
  reference?: GrowthReferenceRow[] | null
  birthDate?: string | null
}>()

const WIDTH = 300
const HEIGHT = 110
const PAD_X = 8
const PAD_TOP = 14
const PAD_BOTTOM = 22
// Con una sola medición (o todas el mismo día) no hay tramo de fechas:
// se abre una ventana de ±15 días para que las bandas tengan anchura y
// el punto quede centrado.
const SINGLE_DAY_PAD_MS = 15 * 86_400_000

const timeDomain = computed(() => {
  const times = props.points.map((p) => new Date(p.date).getTime())
  if (times.length === 0) return { start: 0, end: 1 }
  const start = Math.min(...times)
  const end = Math.max(...times)
  return start === end
    ? { start: start - SINGLE_DAY_PAD_MS, end: end + SINGLE_DAY_PAD_MS }
    : { start, end }
})

const bands = computed(() =>
  referenceSamples(props.reference, props.birthDate, timeDomain.value.start, timeDomain.value.end),
)

function xFor(ms: number): number {
  const { start, end } = timeDomain.value
  return PAD_X + ((ms - start) / (end - start)) * (WIDTH - PAD_X * 2)
}

const xPositions = computed<number[]>(() =>
  props.points.map((p) => xFor(new Date(p.date).getTime())),
)

// La escala vertical abarca también las bandas, para que se vea dónde
// cae el bebé dentro de la referencia y no solo su propia línea.
const valueRange = computed(() => {
  const values = [...props.points.map((p) => p.value), ...bands.value.flatMap((b) => [b.p3, b.p97])]
  const min = Math.min(...values)
  const max = Math.max(...values)
  // A flat line (every reading identical) would divide by zero below -
  // a small fake span keeps it centered instead of crashing the scale.
  return { min, max: max > min ? max : min + 1 }
})

function yFor(value: number): number {
  const { min, max } = valueRange.value
  const drawable = HEIGHT - PAD_TOP - PAD_BOTTOM
  return PAD_TOP + (1 - (value - min) / (max - min)) * drawable
}

const yPositions = computed<number[]>(() => props.points.map((p) => yFor(p.value)))

const linePath = computed(() => {
  const xs = xPositions.value
  const ys = yPositions.value
  if (xs.length < 2) return ''
  return xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x},${ys[i]}`).join(' ')
})

const areaPath = computed(() => {
  // Con bandas detrás, el área bajo la línea se confundiría con ellas.
  if (linePath.value === '' || bands.value.length > 0) return ''
  const xs = xPositions.value
  const floorY = HEIGHT - PAD_BOTTOM
  const firstX = xs[0]
  const lastX = xs[xs.length - 1]
  return `${linePath.value} L${lastX},${floorY} L${firstX},${floorY} Z`
})

function bandPath(upper: 'p97' | 'p85', lower: 'p3' | 'p15'): string {
  const samples = bands.value
  if (samples.length < 2) return ''
  const top = samples.map((s) => `${xFor(s.at)},${yFor(s[upper])}`)
  const bottom = [...samples].reverse().map((s) => `${xFor(s.at)},${yFor(s[lower])}`)
  return `M${top.join(' L')} L${bottom.join(' L')} Z`
}

const outerBand = computed(() => bandPath('p97', 'p3'))
const innerBand = computed(() => bandPath('p85', 'p15'))
const medianPath = computed(() => {
  const samples = bands.value
  if (samples.length < 2) return ''
  return samples.map((s, i) => `${i === 0 ? 'M' : 'L'}${xFor(s.at)},${yFor(s.p50)}`).join(' ')
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
      <path v-if="outerBand" :d="outerBand" fill="currentColor" opacity="0.08" stroke="none" />
      <path v-if="innerBand" :d="innerBand" fill="currentColor" opacity="0.12" stroke="none" />
      <path
        v-if="medianPath"
        :d="medianPath"
        fill="none"
        stroke="currentColor"
        stroke-width="1"
        stroke-dasharray="3 3"
        opacity="0.55"
      />
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
        :text-anchor="points.length > 1 ? 'start' : 'middle'"
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
