<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { FEVER_THRESHOLD_CELSIUS, TEMPERATURE_LEVELS, temperatureLevel } from '@/lib/timelineEntry'

// Gráfica de temperatura del periodo de Estadísticas - responde a
// "¿cuántos episodios ha tenido y cuánto duraron?", a diferencia de la
// tarjeta de 48 h del Dashboard (el episodio en curso). Eje X del inicio
// del periodo (o de la primera medición, con "Todo") a ahora; cada punto
// en el color de su nivel (los mismos de la línea temporal) y la línea
// de 38 °C discontinua.
const props = defineProps<{
  readings: { celsius: number; at: string }[]
  /** Inicio del eje X (ISO). */
  from: string
  dateLocale: string
}>()

const { t } = useI18n()

const WIDTH = 300
const HEIGHT = 90
const PAD_X = 6
const PAD_Y = 8

const startMs = computed(() => new Date(props.from).getTime())
const endMs = computed(() => Math.max(Date.now(), startMs.value + 3_600_000))

const yRange = computed(() => {
  const values = props.readings.map((r) => r.celsius)
  return { min: Math.min(35.5, ...values), max: Math.max(40, ...values) }
})

function xFor(at: string): number {
  const fraction = (new Date(at).getTime() - startMs.value) / (endMs.value - startMs.value)
  return PAD_X + Math.min(1, Math.max(0, fraction)) * (WIDTH - PAD_X * 2)
}

function yFor(celsius: number): number {
  const { min, max } = yRange.value
  return PAD_Y + (1 - (celsius - min) / (max - min)) * (HEIGHT - PAD_Y * 2)
}

const points = computed(() =>
  props.readings.map((r) => ({
    x: xFor(r.at),
    y: yFor(r.celsius),
    color: TEMPERATURE_LEVELS[temperatureLevel(r.celsius)].color,
  })),
)

// Línea tenue que une las mediciones, solo como guía - el color va en
// los puntos.
const linePath = computed(() =>
  points.value.length > 1
    ? points.value.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')
    : '',
)
const thresholdY = computed(() => yFor(FEVER_THRESHOLD_CELSIUS))

function formatDay(ms: number): string {
  return new Date(ms).toLocaleDateString(props.dateLocale, { day: 'numeric', month: 'short' })
}
</script>

<template>
  <figure class="m-0">
    <svg
      :viewBox="`0 0 ${WIDTH} ${HEIGHT}`"
      class="w-full text-temperature"
      role="img"
      :aria-label="t('stats.temperature.chartLabel', { count: readings.length })"
    >
      <line
        :x1="PAD_X"
        :x2="WIDTH - PAD_X"
        :y1="thresholdY"
        :y2="thresholdY"
        stroke="currentColor"
        stroke-width="1"
        stroke-dasharray="3 3"
        opacity="0.45"
      />
      <path
        v-if="linePath"
        :d="linePath"
        fill="none"
        stroke="currentColor"
        stroke-width="1.2"
        opacity="0.35"
        stroke-linejoin="round"
      />
      <circle
        v-for="(point, index) in points"
        :key="index"
        :cx="point.x"
        :cy="point.y"
        r="3"
        :fill="point.color"
      />
    </svg>
    <figcaption class="mt-0.5 flex justify-between text-[0.6rem] text-text-muted">
      <span>{{ formatDay(startMs) }}</span>
      <span>{{ t('dashboard.temperatureCard.thresholdHint') }}</span>
      <span>{{ t('dashboard.temperatureCard.axisEnd') }}</span>
    </figcaption>
  </figure>
</template>
