<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Temperature } from '@/stores/babies'
import CategoryIcon from '@/components/CategoryIcon.vue'
import { FEVER_THRESHOLD_CELSIUS, formatCelsius } from '@/lib/timelineEntry'

// Solo se monta cuando hay alguna medición en las últimas 48 h (ver
// DashboardView.vue) - un episodio de fiebre de un vistazo, no un
// histórico (ese vive en Estadísticas).
const props = defineProps<{
  /** Mediciones de las últimas 48 h, de la más antigua a la más reciente. */
  temperatures: Temperature[]
  dateLocale: string
  /** Bebé de menos de 3 meses: muestra el aviso fijo si alguna medición
   * llega a 38 °C. */
  underThreeMonths: boolean
}>()

const emit = defineEmits<{ add: [] }>()

const { t } = useI18n()

const latest = computed(() => props.temperatures[props.temperatures.length - 1] as Temperature)
const max = computed(() => Math.max(...props.temperatures.map((t) => t.celsius)))
const showInfantWarning = computed(
  () => props.underThreeMonths && max.value >= FEVER_THRESHOLD_CELSIUS,
)

const methodLabel = computed(() =>
  latest.value.method ? t(`dashboard.temperatureForm.methods.${latest.value.method}`) : null,
)

function formatSince(at: string): string {
  const minutes = Math.round((Date.now() - new Date(at).getTime()) / 60_000)
  const rtf = new Intl.RelativeTimeFormat(props.dateLocale, { numeric: 'auto' })
  if (minutes < 60) return rtf.format(-Math.max(minutes, 0), 'minute')
  return rtf.format(-Math.round(minutes / 60), 'hour')
}

// --- Minigráfica: eje X = las 48 h completas (no solo el tramo con
// datos), eje Y entre 35,5 y 40 °C como mínimo, con la línea de 38 °C
// discontinua como referencia. ---
const WIDTH = 300
const HEIGHT = 64
const PAD_X = 6
const PAD_Y = 8
const WINDOW_MS = 48 * 3_600_000

const yRange = computed(() => {
  const values = props.temperatures.map((t) => t.celsius)
  return { min: Math.min(35.5, ...values), max: Math.max(40, ...values) }
})

function xFor(at: string): number {
  const start = Date.now() - WINDOW_MS
  const fraction = (new Date(at).getTime() - start) / WINDOW_MS
  return PAD_X + Math.min(1, Math.max(0, fraction)) * (WIDTH - PAD_X * 2)
}

function yFor(celsius: number): number {
  const { min, max } = yRange.value
  return PAD_Y + (1 - (celsius - min) / (max - min)) * (HEIGHT - PAD_Y * 2)
}

const points = computed(() =>
  props.temperatures.map((t) => ({
    x: xFor(t.measured_at),
    y: yFor(t.celsius),
    high: t.celsius >= FEVER_THRESHOLD_CELSIUS,
  })),
)
const linePath = computed(() =>
  points.value.length > 1
    ? points.value.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')
    : '',
)
const thresholdY = computed(() => yFor(FEVER_THRESHOLD_CELSIUS))
</script>

<template>
  <section class="card flex flex-col gap-2 p-4">
    <div class="flex items-center justify-between gap-2">
      <h2 class="flex items-center gap-2 font-display text-sm font-bold">
        <span class="grid h-7 w-7 place-items-center rounded-lg bg-temperature/15 text-temperature">
          <CategoryIcon category="temperature" class="h-4 w-4" />
        </span>
        {{ t('dashboard.temperatureCard.title') }}
        <span class="text-xs font-normal text-text-muted">{{
          t('dashboard.temperatureCard.window')
        }}</span>
      </h2>
      <button
        v-press
        type="button"
        class="rounded-full bg-temperature/15 px-3 py-1.5 text-xs font-bold text-temperature"
        @click="emit('add')"
      >
        {{ t('dashboard.temperatureCard.add') }}
      </button>
    </div>

    <div class="flex items-end justify-between gap-3">
      <div>
        <div class="text-2xl font-bold tabular-nums">
          {{ formatCelsius(latest.celsius, dateLocale) }}
        </div>
        <div class="text-xs text-text-muted">
          {{ formatSince(latest.measured_at)
          }}<template v-if="methodLabel"> · {{ methodLabel }}</template>
        </div>
      </div>
      <div v-if="temperatures.length > 1" class="text-right text-xs text-text-muted">
        {{ t('dashboard.temperatureCard.max') }}
        <span class="font-bold tabular-nums text-text">{{ formatCelsius(max, dateLocale) }}</span>
      </div>
    </div>

    <svg
      :viewBox="`0 0 ${WIDTH} ${HEIGHT}`"
      class="w-full text-temperature"
      role="img"
      :aria-label="t('dashboard.temperatureCard.chartLabel', { count: temperatures.length })"
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
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <circle
        v-for="(point, index) in points"
        :key="index"
        :cx="point.x"
        :cy="point.y"
        :r="index === points.length - 1 ? 3.5 : 2.5"
        fill="currentColor"
        :opacity="point.high ? 1 : 0.6"
      />
    </svg>
    <div class="-mt-1 flex justify-between text-[0.6rem] text-text-muted">
      <span>{{ t('dashboard.temperatureCard.axisStart') }}</span>
      <span>{{ t('dashboard.temperatureCard.thresholdHint') }}</span>
      <span>{{ t('dashboard.temperatureCard.axisEnd') }}</span>
    </div>

    <p
      v-if="showInfantWarning"
      class="rounded-xl bg-danger/10 px-3 py-2 text-xs font-semibold text-danger"
      role="note"
    >
      {{ t('dashboard.temperatureCard.infantWarning') }}
    </p>
  </section>
</template>
