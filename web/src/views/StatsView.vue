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
import {
  summarizeSleepStats,
  summarizeFeedStats,
  summarizeDiaperStats,
  summarizeGrowthStats,
  buildStatsExportPayload,
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
    await Promise.all([babies.fetchStatsData(), babies.fetchGrowthMeasurements()])
  } finally {
    loading.value = false
  }
})

const sleepStats = computed(() => summarizeSleepStats(babies.statsSleeps))
const feedStats = computed(() => summarizeFeedStats(babies.statsFeeds))
const diaperStats = computed(() => summarizeDiaperStats(babies.statsDiaperChanges))
const growthStats = computed(() => summarizeGrowthStats(babies.growthMeasurements))

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
  exporting.value = true
  try {
    const payload = buildStatsExportPayload(
      sleepStats.value,
      feedStats.value,
      diaperStats.value,
      growthStats.value,
    )
    const blob = await babies.exportStatsPdf(payload)
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'estadisticas.pdf'
    link.click()
    URL.revokeObjectURL(url)
    justExported.value = true
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
