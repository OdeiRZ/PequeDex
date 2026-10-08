<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import { useBabiesStore } from '@/stores/babies'
import { useToastStore } from '@/stores/toast'
import { useFeedback } from '@/composables/useFeedback'
import AppMark from '@/components/AppMark.vue'
import HourBucketChart from '@/components/HourBucketChart.vue'
import GrowthLineChart from '@/components/GrowthLineChart.vue'
import WeeklyTrendChart from '@/components/WeeklyTrendChart.vue'
import ActivityHeatmap from '@/components/ActivityHeatmap.vue'
import {
  summarizeSleepStats,
  summarizeFeedStats,
  summarizeDiaperStats,
  summarizeGrowthStats,
  summarizeWeeklyTrend,
  summarizeWeekComparison,
  summarizeActivityHeatmap,
  buildStatsExportPayload,
  formatClockTime,
} from '@/lib/stats'
import { ALL_CATEGORIES, type Category } from '@/lib/category'
import type { DiaperSize } from '@/stores/babies'

const { t, locale } = useI18n()
const auth = useAuthStore()
const babies = useBabiesStore()
const toast = useToastStore()
const feedback = useFeedback()

const dateLocale = computed(() => (locale.value === 'es' ? 'es-ES' : 'en-GB'))

// Mismo significado que ya usa la barra de accesos del dashboard
// (`enabledCategories` en `DashboardView.vue`) y el propio backend:
// `null` = las 5 categorías visibles, sin personalizar. Un bloque de
// estadísticas que ya no se accede a diario (p.ej. sueño, si el
// cuidador lo desactivó) no debería seguir apareciendo aquí solo
// porque haya datos antiguos - el ajuste es "no me interesa esto",
// no "no he logueado nada todavía".
const enabledCategories = computed<Category[]>(
  () => auth.user?.action_bar_categories ?? [...ALL_CATEGORIES],
)

const loading = ref(true)

onMounted(async () => {
  loading.value = true
  try {
    // Al navegar desde el Dashboard, `babies.current` ya está cargado
    // (el propio Dashboard llama a `fetchCurrent()` en su `onMounted`).
    // Pero entrando directo aquí (recarga de página, enlace compartido),
    // el store de Pinia arranca desde cero y `fetchStatsData()`/
    // `fetchGrowthMeasurements()` se cortan en seco (dependen de
    // `babies.current`) si nadie lo ha pedido todavía - mismo motivo por
    // el que ContractionsView.vue hace este mismo chequeo.
    if (!babies.current) {
      await babies.fetchCurrent()
    }
    await Promise.all([babies.fetchStatsData(), babies.fetchGrowthMeasurements()])
  } finally {
    loading.value = false
  }
})

const sleepStats = computed(() => summarizeSleepStats(babies.statsSleeps))
const feedStats = computed(() => summarizeFeedStats(babies.statsFeeds))
const diaperStats = computed(() => summarizeDiaperStats(babies.statsDiaperChanges))
const growthStats = computed(() => summarizeGrowthStats(babies.growthMeasurements))

const weeklyTrend = computed(() =>
  summarizeWeeklyTrend(babies.statsSleeps, babies.statsFeeds, babies.statsDiaperChanges),
)
const activityHeatmap = computed(() =>
  summarizeActivityHeatmap(babies.statsSleeps, babies.statsFeeds, babies.statsDiaperChanges),
)

// "6 ago" - corto a propósito, son muchas etiquetas seguidas en una
// fila con scroll horizontal, no una sola fecha destacada.
function weekLabel(weekStart: string): string {
  return new Date(`${weekStart}T00:00:00`).toLocaleDateString(dateLocale.value, {
    day: 'numeric',
    month: 'short',
  })
}

const sleepWeeklyPoints = computed(() =>
  weeklyTrend.value.map((w) => ({
    label: weekLabel(w.weekStart),
    value: w.sleepHours !== null ? Math.round(w.sleepHours * 10) / 10 : null,
  })),
)
const feedWeeklyPoints = computed(() =>
  weeklyTrend.value.map((w) => ({ label: weekLabel(w.weekStart), value: w.feedCount })),
)
const diaperWeeklyPoints = computed(() =>
  weeklyTrend.value.map((w) => ({ label: weekLabel(w.weekStart), value: w.diaperCount })),
)

function formatHours(value: number): string {
  return `${value}h`
}

const weekComparison = computed(() => summarizeWeekComparison(weeklyTrend.value))

function formatDelta(delta: number, decimals = 0): string {
  const rounded = Math.abs(delta) < 0.05 ? 0 : delta
  const sign = rounded > 0 ? '+' : ''
  return `${sign}${rounded.toFixed(decimals)}`
}

function formatMinutes(minutes: number): string {
  const rounded = Math.round(minutes)
  const hours = Math.floor(rounded / 60)
  const remaining = rounded % 60
  return hours > 0 ? `${hours}h ${remaining}min` : `${remaining}min`
}

function formatCount(count: number): string {
  return String(Math.round(count))
}

function formatGain(value: number, decimals: number, unit: string): string {
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(decimals)} ${unit}`
}

// Qué parte de la barra de reparto día/noche pinta de color sólido -
// un entero 0-100 para usar directo en `width: X%`, con el propio
// reparto ya protegido de división por cero por el `v-if` del template
// (solo se pinta con `averageTotalSleepMinutes !== null`, que implica
// que ambas partes son números reales, aunque alguna sea 0).
const nightSleepSharePercent = computed(() => {
  const night = sleepStats.value.averageNightSleepMinutes ?? 0
  const total = sleepStats.value.averageTotalSleepMinutes ?? 0
  return total > 0 ? Math.round((night / total) * 100) : 100
})

// Traduce la desviación típica en minutos (un número que no dice nada
// por sí solo) a una lectura cualitativa - "qué tan regular es el
// horario", la pregunta real detrás del dato. Umbrales orientativos,
// no un estándar clínico: menos de media hora de variación entre
// tomas se lee como "muy regular", menos de una hora como "regular",
// más como "variable".
function formatRegularity(stdDevMinutes: number): string {
  if (stdDevMinutes < 30) return t('stats.regularity.veryRegular')
  if (stdDevMinutes < 60) return t('stats.regularity.regular')
  return t('stats.regularity.variable')
}

function formatLongestSleepDate(at: string): string {
  return new Date(at).toLocaleDateString(dateLocale.value, { day: 'numeric', month: 'long' })
}

// Mismo orden que ya usa la pastilla de la línea temporal (ver
// DashboardView.vue) y el propio selector de "+ Pañal" - 0 primero,
// "sin indicar" al final en vez de mezclado entre las tallas numéricas.
const DIAPER_SIZE_ORDER: (DiaperSize | 'unspecified')[] = [
  '0',
  '1',
  '2',
  '3',
  '4',
  '5',
  '6+',
  'unspecified',
]

const diaperSizeRows = computed(() =>
  DIAPER_SIZE_ORDER.map((size) => ({ size, count: diaperStats.value.bySize[size] })).filter(
    (row) => row.count > 0,
  ),
)

function percent(part: number, total: number): string {
  return total > 0 ? `${Math.round((part / total) * 100)}%` : '0%'
}

// Driven by a table rather than three copy-pasted template blocks -
// weight/height/head only differ in unit, decimal precision, and which
// slice of `growthStats` they read.
const growthMetrics = computed(() => [
  {
    key: 'weight' as const,
    stat: growthStats.value.weightKg,
    unit: 'kg',
    decimals: 1,
    titleKey: 'stats.growth.weightTitle',
  },
  {
    key: 'height' as const,
    stat: growthStats.value.heightCm,
    unit: 'cm',
    decimals: 0,
    titleKey: 'stats.growth.heightTitle',
  },
  {
    key: 'head' as const,
    stat: growthStats.value.headCircumferenceCm,
    unit: 'cm',
    decimals: 0,
    titleKey: 'stats.growth.headTitle',
  },
])

const hasAnyGrowthData = computed(() => growthMetrics.value.some((m) => m.stat.count > 0))

// --- Exportar PDF ---
// Igual que ContractionsView.vue: el store solo trae el Blob (auth por
// Bearer token, no cookies, así que un <a href> directo no valdría).

const exporting = ref(false)
const justExported = ref(false)
let justExportedTimer: ReturnType<typeof setTimeout> | undefined

const hasAnyStatsData = computed(
  () =>
    sleepStats.value.hasEnoughData ||
    feedStats.value.hasEnoughData ||
    diaperStats.value.hasEnoughData ||
    hasAnyGrowthData.value,
)

async function onExportPdf() {
  // Dos eventos de sonido/vibración independientes, no v-press genérico:
  // "download" al pulsar (empieza a generarse), "downloadDone" cuando el
  // icono pasa a su tick de confirmación (ya está listo y descargado).
  feedback.download()
  exporting.value = true
  try {
    const payload = buildStatsExportPayload(
      sleepStats.value,
      feedStats.value,
      diaperStats.value,
      growthStats.value,
      weekComparison.value,
      weeklyTrend.value,
      activityHeatmap.value,
    )
    const blob = await babies.exportStatsPdf(payload)
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'estadisticas.pdf'
    link.click()
    URL.revokeObjectURL(url)
    justExported.value = true
    feedback.downloadDone()
    clearTimeout(justExportedTimer)
    justExportedTimer = setTimeout(() => {
      justExported.value = false
    }, 1400)
  } catch {
    toast.show(t('stats.exportError'), 'error')
  } finally {
    exporting.value = false
  }
}
</script>

<template>
  <main class="flex flex-1 flex-col gap-5 px-4 py-5 pb-10">
    <div class="flex items-center justify-between">
      <RouterLink
        :to="{ name: 'dashboard' }"
        class="grid h-9 w-9 shrink-0 place-items-center rounded-full text-text-muted transition-colors hover:text-text active:text-text"
        :aria-label="t('common.back')"
        @click="feedback.navBack()"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="h-5 w-5"
        >
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
      </RouterLink>
      <h1 class="font-display text-lg font-bold">{{ t('stats.title') }}</h1>
      <button
        type="button"
        class="export-btn relative grid h-9 w-9 shrink-0 place-items-center rounded-full text-text-muted transition-colors hover:text-text active:text-text disabled:opacity-50"
        :class="[exporting && 'is-exporting', justExported && 'is-done']"
        :disabled="exporting || loading || !hasAnyStatsData"
        :aria-label="t('stats.export')"
        @click="onExportPdf"
      >
        <span class="export-ring" aria-hidden="true"></span>
        <svg
          v-if="!justExported"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="h-5 w-5"
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <path d="M7 10l5 5 5-5M12 15V3" />
        </svg>
        <svg
          v-else
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="export-check h-5 w-5"
        >
          <path d="M5 13l4 4L19 7" />
        </svg>
      </button>
    </div>

    <div
      v-if="loading"
      class="flex flex-1 flex-col items-center justify-center gap-4 text-text-muted"
    >
      <AppMark full wiggle-toes beat-heart :size="72" />
      {{ t('common.loading') }}
    </div>

    <template v-else>
      <!-- Tomas -->
      <section v-if="enabledCategories.includes('feed')" class="card flex flex-col gap-3 p-4">
        <h2 class="flex items-center gap-2 font-display text-sm font-bold">
          <span class="h-4 w-1.5 shrink-0 rounded-full bg-feed"></span>
          {{ t('stats.feed.title') }}
        </h2>

        <template v-if="feedStats.hasEnoughData">
          <div class="grid grid-cols-2 gap-3">
            <div class="rounded-xl bg-surface-sunken p-3">
              <div class="text-xs text-text-muted">{{ t('stats.feed.pechoShareLabel') }}</div>
              <div class="text-lg font-bold tabular-nums">
                {{ percent(feedStats.byType.pecho, feedStats.total) }}
              </div>
            </div>
            <div class="rounded-xl bg-surface-sunken p-3">
              <div class="text-xs text-text-muted">{{ t('stats.feed.biberonShareLabel') }}</div>
              <div class="text-lg font-bold tabular-nums">
                {{ percent(feedStats.byType.biberon, feedStats.total) }}
              </div>
            </div>
            <div
              v-if="feedStats.averagePechoDurationMinutes !== null"
              class="rounded-xl bg-surface-sunken p-3"
            >
              <div class="text-xs text-text-muted">{{ t('stats.feed.pechoDurationLabel') }}</div>
              <div class="text-lg font-bold tabular-nums">
                {{ formatMinutes(feedStats.averagePechoDurationMinutes) }}
              </div>
            </div>
            <div
              v-if="feedStats.averageBottleAmountMl !== null"
              class="rounded-xl bg-surface-sunken p-3"
            >
              <div class="text-xs text-text-muted">{{ t('stats.feed.bottleAmountLabel') }}</div>
              <div class="text-lg font-bold tabular-nums">
                {{ Math.round(feedStats.averageBottleAmountMl) }} ml
              </div>
            </div>
            <div
              v-if="feedStats.averageGapMinutes !== null"
              class="rounded-xl bg-surface-sunken p-3"
            >
              <div class="text-xs text-text-muted">{{ t('stats.feed.gapLabel') }}</div>
              <div class="text-lg font-bold tabular-nums">
                {{ formatMinutes(feedStats.averageGapMinutes) }}
              </div>
            </div>
            <div v-if="feedStats.averagePerDay !== null" class="rounded-xl bg-surface-sunken p-3">
              <div class="text-xs text-text-muted">{{ t('stats.feed.perDayLabel') }}</div>
              <div class="text-lg font-bold tabular-nums">
                {{ feedStats.averagePerDay.toFixed(1) }}
              </div>
            </div>
            <div
              v-if="feedStats.gapStdDevMinutes !== null"
              class="rounded-xl bg-surface-sunken p-3"
            >
              <div class="text-xs text-text-muted">{{ t('stats.feed.regularityLabel') }}</div>
              <div class="text-lg font-bold tabular-nums">
                {{ formatRegularity(feedStats.gapStdDevMinutes) }}
              </div>
            </div>
          </div>
          <div
            v-if="feedStats.byType.pecho > 0"
            class="flex items-center justify-between rounded-xl bg-surface-sunken p-3 text-xs"
          >
            <span class="text-text-muted">{{ t('dashboard.feedForm.left') }}</span>
            <span class="font-bold tabular-nums">{{ feedStats.pechoSideCounts.izquierdo }}</span>
            <span class="text-text-muted">{{ t('dashboard.feedForm.right') }}</span>
            <span class="font-bold tabular-nums">{{ feedStats.pechoSideCounts.derecho }}</span>
            <span class="text-text-muted">{{ t('dashboard.feedForm.both') }}</span>
            <span class="font-bold tabular-nums">{{ feedStats.pechoSideCounts.ambos }}</span>
          </div>
          <div>
            <div class="mb-1 text-xs text-text-muted">{{ t('stats.feed.byHourLabel') }}</div>
            <HourBucketChart
              :buckets="feedStats.byHourBucket"
              category="feed"
              :format-value="formatCount"
            />
          </div>
        </template>
        <p v-else class="py-2 text-center text-sm text-text-muted">
          {{ t('stats.notEnoughData') }}
        </p>
      </section>

      <!-- Sueño -->
      <section v-if="enabledCategories.includes('sleep')" class="card flex flex-col gap-3 p-4">
        <h2 class="flex items-center gap-2 font-display text-sm font-bold">
          <span class="h-4 w-1.5 shrink-0 rounded-full bg-sleep"></span>
          {{ t('stats.sleep.title') }}
        </h2>

        <template v-if="sleepStats.hasEnoughData">
          <div class="grid grid-cols-2 gap-3">
            <div class="rounded-xl bg-surface-sunken p-3">
              <div class="text-xs text-text-muted">{{ t('stats.sleep.totalLabel') }}</div>
              <div class="text-lg font-bold tabular-nums">{{ sleepStats.totalCompleted }}</div>
            </div>
            <div class="rounded-xl bg-surface-sunken p-3">
              <div class="text-xs text-text-muted">{{ t('stats.sleep.averageLabel') }}</div>
              <div class="text-lg font-bold tabular-nums">
                {{ formatMinutes(sleepStats.averageDurationMinutes ?? 0) }}
              </div>
            </div>
            <div
              v-if="sleepStats.averageWakeWindowMinutes !== null"
              class="rounded-xl bg-surface-sunken p-3"
            >
              <div class="text-xs text-text-muted">{{ t('stats.sleep.wakeWindowLabel') }}</div>
              <div class="text-lg font-bold tabular-nums">
                {{ formatMinutes(sleepStats.averageWakeWindowMinutes) }}
              </div>
            </div>
            <div v-if="sleepStats.typicalBedtime" class="rounded-xl bg-surface-sunken p-3">
              <div class="text-xs text-text-muted">{{ t('stats.sleep.typicalBedtimeLabel') }}</div>
              <div class="text-lg font-bold tabular-nums">
                {{ formatClockTime(sleepStats.typicalBedtime) }}
              </div>
            </div>
            <div v-if="sleepStats.typicalWakeTime" class="rounded-xl bg-surface-sunken p-3">
              <div class="text-xs text-text-muted">{{ t('stats.sleep.typicalWakeLabel') }}</div>
              <div class="text-lg font-bold tabular-nums">
                {{ formatClockTime(sleepStats.typicalWakeTime) }}
              </div>
            </div>
          </div>

          <!-- Reparto día/noche: la pregunta real es "¿duerme lo que
               toca?", no solo a qué hora. -->
          <div
            v-if="sleepStats.averageTotalSleepMinutes !== null"
            class="rounded-xl bg-surface-sunken p-3"
          >
            <div class="mb-1.5 flex items-center justify-between">
              <span class="text-xs text-text-muted">{{ t('stats.sleep.dayNightLabel') }}</span>
              <span class="text-sm font-bold tabular-nums">
                {{ formatMinutes(sleepStats.averageTotalSleepMinutes) }}
                <span class="font-normal text-text-muted">{{ t('stats.sleep.dailyTotal') }}</span>
              </span>
            </div>
            <div class="flex h-2.5 overflow-hidden rounded-full bg-surface">
              <span
                class="bg-sleep"
                :style="{ width: nightSleepSharePercent + '%' }"
                :aria-label="t('stats.sleep.nightShareLabel')"
              ></span>
              <span
                class="bg-sleep/40"
                :style="{ width: 100 - nightSleepSharePercent + '%' }"
              ></span>
            </div>
            <div class="mt-1.5 flex items-center justify-between text-xs text-text-muted">
              <span
                >{{ t('stats.sleep.nightLabel') }} ·
                {{ formatMinutes(sleepStats.averageNightSleepMinutes ?? 0) }}</span
              >
              <span
                >{{ t('stats.sleep.napsLabel') }} ·
                {{ formatMinutes(sleepStats.averageNapMinutes ?? 0) }}</span
              >
            </div>
          </div>

          <div>
            <div class="mb-1 text-xs text-text-muted">{{ t('stats.sleep.byHourLabel') }}</div>
            <HourBucketChart
              :buckets="sleepStats.byHourBucket"
              category="sleep"
              :format-value="formatMinutes"
            />
          </div>
        </template>
        <p v-else class="py-2 text-center text-sm text-text-muted">
          {{ t('stats.notEnoughData') }}
        </p>

        <!-- Récord: aparece siempre que haya al menos un sueño
             completado, sin depender de hasEnoughData - es un dato
             puntual, no una media. -->
        <div
          v-if="sleepStats.longestSleep"
          class="flex items-center justify-between rounded-xl bg-surface-sunken p-3"
        >
          <div>
            <div class="text-xs text-text-muted">{{ t('stats.sleep.longestLabel') }}</div>
            <div class="text-xs text-text-muted">
              {{ formatLongestSleepDate(sleepStats.longestSleep.date) }}
            </div>
          </div>
          <div class="text-lg font-bold tabular-nums text-sleep">
            {{ formatMinutes(sleepStats.longestSleep.minutes) }}
          </div>
        </div>
      </section>

      <!-- Pañales -->
      <section v-if="enabledCategories.includes('diaper')" class="card flex flex-col gap-3 p-4">
        <h2 class="flex items-center gap-2 font-display text-sm font-bold">
          <span class="h-4 w-1.5 shrink-0 rounded-full bg-diaper"></span>
          {{ t('stats.diaper.title') }}
        </h2>

        <template v-if="diaperStats.hasEnoughData">
          <div class="grid grid-cols-2 gap-3">
            <div class="rounded-xl bg-surface-sunken p-3">
              <div class="text-xs text-text-muted">{{ t('dashboard.diaperForm.wet') }}</div>
              <div class="text-lg font-bold tabular-nums">
                {{ percent(diaperStats.byType.mojado, diaperStats.total) }}
              </div>
            </div>
            <div class="rounded-xl bg-surface-sunken p-3">
              <div class="text-xs text-text-muted">{{ t('dashboard.diaperForm.dirty') }}</div>
              <div class="text-lg font-bold tabular-nums">
                {{ percent(diaperStats.byType.sucio, diaperStats.total) }}
              </div>
            </div>
            <div class="rounded-xl bg-surface-sunken p-3">
              <div class="text-xs text-text-muted">{{ t('dashboard.diaperForm.both') }}</div>
              <div class="text-lg font-bold tabular-nums">
                {{ percent(diaperStats.byType.ambos, diaperStats.total) }}
              </div>
            </div>
            <div v-if="diaperStats.averagePerDay !== null" class="rounded-xl bg-surface-sunken p-3">
              <div class="text-xs text-text-muted">{{ t('stats.diaper.perDayLabel') }}</div>
              <div class="text-lg font-bold tabular-nums">
                {{ diaperStats.averagePerDay.toFixed(1) }}
              </div>
            </div>
            <div
              v-if="diaperStats.averageWetPerDay !== null"
              class="rounded-xl bg-surface-sunken p-3"
            >
              <div class="text-xs text-text-muted">{{ t('stats.diaper.wetPerDayLabel') }}</div>
              <div class="text-lg font-bold tabular-nums">
                {{ diaperStats.averageWetPerDay.toFixed(1) }}
              </div>
            </div>
          </div>

          <div v-if="diaperSizeRows.length > 0">
            <div class="mb-1 text-xs text-text-muted">{{ t('stats.diaper.bySizeLabel') }}</div>
            <div class="flex flex-wrap gap-2">
              <div
                v-for="row in diaperSizeRows"
                :key="row.size"
                class="rounded-full bg-surface-sunken px-3 py-1.5 text-xs font-semibold"
              >
                {{
                  row.size === 'unspecified'
                    ? t('dashboard.diaperForm.sizeUnspecified')
                    : t('dashboard.diaperForm.sizeBadge', { size: row.size })
                }}
                <span class="text-text-muted">· {{ row.count }}</span>
              </div>
            </div>
          </div>

          <div>
            <div class="mb-1 text-xs text-text-muted">{{ t('stats.diaper.peeByHourLabel') }}</div>
            <HourBucketChart
              :buckets="diaperStats.peeByHourBucket"
              category="diaper"
              :format-value="formatCount"
            />
          </div>
          <div>
            <div class="mb-1 text-xs text-text-muted">{{ t('stats.diaper.poopByHourLabel') }}</div>
            <HourBucketChart
              :buckets="diaperStats.poopByHourBucket"
              category="diaper"
              :format-value="formatCount"
            />
          </div>
        </template>
        <p v-else class="py-2 text-center text-sm text-text-muted">
          {{ t('stats.notEnoughData') }}
        </p>
      </section>

      <!-- Crecimiento -->
      <section v-if="enabledCategories.includes('growth')" class="card flex flex-col gap-4 p-4">
        <h2 class="flex items-center gap-2 font-display text-sm font-bold">
          <span class="h-4 w-1.5 shrink-0 rounded-full bg-growth"></span>
          {{ t('stats.growth.title') }}
        </h2>

        <template v-if="hasAnyGrowthData">
          <div v-for="metric in growthMetrics" :key="metric.key">
            <template v-if="metric.stat.count > 0">
              <div class="mb-1 flex items-center justify-between">
                <span class="text-xs text-text-muted">{{ t(metric.titleKey) }}</span>
                <span
                  v-if="metric.stat.latestPercentile !== null"
                  class="text-xs font-semibold text-growth"
                >
                  {{
                    t('stats.growth.percentile', {
                      value: Math.round(metric.stat.latestPercentile),
                    })
                  }}
                </span>
              </div>

              <template v-if="metric.stat.count > 1">
                <GrowthLineChart
                  :points="metric.stat.points"
                  :unit="metric.unit"
                  :decimals="metric.decimals"
                  :date-locale="dateLocale"
                />
                <div class="mt-1 flex items-baseline justify-between">
                  <span class="text-lg font-bold tabular-nums">
                    {{ metric.stat.latestValue?.toFixed(metric.decimals) }} {{ metric.unit }}
                  </span>
                  <span
                    v-if="metric.stat.gained !== null"
                    class="text-xs font-semibold tabular-nums text-text-muted"
                  >
                    {{ formatGain(metric.stat.gained, metric.decimals, metric.unit) }}
                    {{ t('stats.growth.sinceFirst') }}
                  </span>
                </div>
                <div
                  v-if="metric.stat.weeklyRate !== null"
                  class="mt-0.5 text-right text-xs text-text-muted"
                >
                  {{ formatGain(metric.stat.weeklyRate, metric.decimals, metric.unit) }}
                  {{ t('stats.growth.perWeek') }}
                </div>
              </template>
              <div v-else class="text-lg font-bold tabular-nums">
                {{ metric.stat.latestValue?.toFixed(metric.decimals) }} {{ metric.unit }}
              </div>
            </template>
          </div>
        </template>
        <p v-else class="py-2 text-center text-sm text-text-muted">
          {{ t('stats.growth.empty') }}
        </p>
      </section>

      <!-- Tendencia semanal - "¿mejora o empeora el patrón?", no solo
           una media puntual. Sin umbral de datos mínimos (como
           Crecimiento): una semana con poco dato se ve más vacía en el
           propio gráfico, eso ya es información. -->
      <section
        v-if="
          enabledCategories.includes('sleep') ||
          enabledCategories.includes('feed') ||
          enabledCategories.includes('diaper')
        "
        class="card flex flex-col gap-4 p-4"
      >
        <h2 class="flex items-center gap-2 font-display text-sm font-bold">
          <span
            class="h-4 w-1.5 shrink-0 rounded-full"
            style="background: linear-gradient(180deg, var(--brand), var(--brand-teal))"
          ></span>
          {{ t('stats.trend.title') }}
        </h2>

        <div v-if="weekComparison" class="flex gap-3 text-center">
          <div
            v-if="weekComparison.sleepHours && enabledCategories.includes('sleep')"
            class="flex-1 rounded-xl bg-surface-sunken p-3"
          >
            <div class="text-xs text-text-muted">{{ t('stats.trend.sleepLabel') }}</div>
            <div
              class="text-lg font-bold tabular-nums"
              :class="weekComparison.sleepHours.delta >= 0 ? 'text-sleep' : 'text-text-muted'"
            >
              {{ formatDelta(weekComparison.sleepHours.delta, 1) }}h
            </div>
          </div>
          <div
            v-if="enabledCategories.includes('feed')"
            class="flex-1 rounded-xl bg-surface-sunken p-3"
          >
            <div class="text-xs text-text-muted">{{ t('stats.trend.feedLabel') }}</div>
            <div
              class="text-lg font-bold tabular-nums"
              :class="weekComparison.feedCount.delta >= 0 ? 'text-feed' : 'text-text-muted'"
            >
              {{ formatDelta(weekComparison.feedCount.delta) }}
            </div>
          </div>
          <div
            v-if="enabledCategories.includes('diaper')"
            class="flex-1 rounded-xl bg-surface-sunken p-3"
          >
            <div class="text-xs text-text-muted">{{ t('stats.trend.diaperLabel') }}</div>
            <div
              class="text-lg font-bold tabular-nums"
              :class="weekComparison.diaperCount.delta >= 0 ? 'text-diaper' : 'text-text-muted'"
            >
              {{ formatDelta(weekComparison.diaperCount.delta) }}
            </div>
          </div>
        </div>
        <p v-if="weekComparison" class="-mt-1 text-center text-xs text-text-muted">
          {{ t('stats.trend.comparisonHint') }}
        </p>

        <div v-if="enabledCategories.includes('sleep')">
          <div class="mb-1 text-xs text-text-muted">{{ t('stats.trend.sleepLabel') }}</div>
          <WeeklyTrendChart
            :points="sleepWeeklyPoints"
            category="sleep"
            :format-value="formatHours"
          />
        </div>
        <div v-if="enabledCategories.includes('feed')">
          <div class="mb-1 text-xs text-text-muted">{{ t('stats.trend.feedLabel') }}</div>
          <WeeklyTrendChart
            :points="feedWeeklyPoints"
            category="feed"
            :format-value="formatCount"
          />
        </div>
        <div v-if="enabledCategories.includes('diaper')">
          <div class="mb-1 text-xs text-text-muted">{{ t('stats.trend.diaperLabel') }}</div>
          <WeeklyTrendChart
            :points="diaperWeeklyPoints"
            category="diaper"
            :format-value="formatCount"
          />
        </div>
      </section>

      <!-- Mapa de actividad - cuándo pasan cosas de verdad, por día de
           la semana y hora, más fino que las 4 franjas de 6h de cada
           bloque. -->
      <section
        v-if="
          enabledCategories.includes('sleep') ||
          enabledCategories.includes('feed') ||
          enabledCategories.includes('diaper')
        "
        class="card flex flex-col gap-3 p-4"
      >
        <h2 class="flex items-center gap-2 font-display text-sm font-bold">
          <span
            class="h-4 w-1.5 shrink-0 rounded-full"
            style="background: linear-gradient(180deg, var(--brand), var(--brand-teal))"
          ></span>
          {{ t('stats.heatmap.title') }}
        </h2>
        <p class="-mt-2 text-xs text-text-muted">{{ t('stats.heatmap.subtitle') }}</p>
        <ActivityHeatmap :cells="activityHeatmap" :date-locale="dateLocale" />
      </section>
    </template>
  </main>
</template>

<style scoped>
.export-ring {
  position: absolute;
  inset: -1.5px;
  border-radius: 999px;
  border: 2px solid transparent;
  border-top-color: var(--brand-teal);
  opacity: 0;
  pointer-events: none;
}

.export-btn.is-exporting .export-ring {
  opacity: 1;
  animation: export-ring-spin 0.7s linear infinite;
}

@keyframes export-ring-spin {
  to {
    transform: rotate(360deg);
  }
}

.export-btn.is-done {
  color: var(--diaper);
}

.export-check {
  stroke-dasharray: 20;
  stroke-dashoffset: 20;
  animation: export-check-draw 0.35s ease forwards;
}

@keyframes export-check-draw {
  to {
    stroke-dashoffset: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .export-btn.is-exporting .export-ring {
    animation: none;
    opacity: 0;
  }

  .export-check {
    animation: none;
    stroke-dashoffset: 0;
  }
}
</style>
