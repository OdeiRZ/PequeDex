<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useBabiesStore, type Contraction } from '@/stores/babies'
import { useToastStore } from '@/stores/toast'
import BottomSheet from '@/components/BottomSheet.vue'
import ContractionTimeline from '@/components/ContractionTimeline.vue'
import {
  nowForInput,
  toLocalInputValue,
  toLocalInputValueWithSeconds,
  toUtcIso,
} from '@/lib/datetimeInput'
import { LONG_GAP_MINUTES, summarizeRecentContractions } from '@/lib/contractionStats'

const babies = useBabiesStore()
const toast = useToastStore()
const { t, locale } = useI18n()

const dateLocale = computed(() => (locale.value === 'es' ? 'es-ES' : 'en-GB'))

const loading = ref(true)
const loadError = ref(false)

async function loadContractions() {
  loading.value = true
  loadError.value = false

  try {
    if (!babies.current) {
      await babies.fetchCurrent()
    }
    if (babies.current) {
      await babies.fetchContractions()
    }
  } catch {
    loadError.value = true
  } finally {
    loading.value = false
  }
}

onMounted(loadContractions)

// A single shared clock, not one setInterval per running row - both the
// big timer button and ContractionTimeline's live duration read off the
// same `now`, so they tick in visual lockstep instead of drifting a few
// ms apart from two independent intervals.
const now = ref(new Date())
let clockTimer: ReturnType<typeof setInterval> | undefined

onMounted(() => {
  clockTimer = setInterval(() => {
    now.value = new Date()
  }, 1000)
})

onUnmounted(() => {
  clearInterval(clockTimer)
})

const activeContraction = computed<Contraction | undefined>(() =>
  babies.contractions.find((c) => c.ended_at === null),
)

// Live "time since the last contraction ended" - ticks with the same
// shared `now` as the running-contraction timer, so the mother sees the
// gap growing in real time instead of only finding out its final value
// after the next contraction starts and the interval chip appears in
// the timeline. `babies.contractions` is newest-first, so with no
// contraction currently running, index 0 (if any) is the last one that
// finished.
const lastStoppedContraction = computed<Contraction | undefined>(() =>
  activeContraction.value ? undefined : babies.contractions[0],
)

// Past LONG_GAP_MINUTES, stop ticking and show the same "> 60 min"
// text as ContractionTimeline's own interval chips once a contraction
// starts and this becomes a real interval - the two shouldn't disagree
// about when a gap stops being "a real number of minutes" and starts
// being "labor paused for a while". The elapsed time itself keeps
// growing underneath regardless (nothing here freezes `now`), only the
// displayed text stops changing.
const sinceLastLabel = computed<string | null>(() => {
  const last = lastStoppedContraction.value
  if (!last?.ended_at) return null

  const elapsedMs = now.value.getTime() - new Date(last.ended_at).getTime()
  if (Math.floor(elapsedMs / 60_000) >= LONG_GAP_MINUTES) {
    return t('contractions.longGap', { min: LONG_GAP_MINUTES })
  }

  const totalSeconds = Math.max(0, Math.round(elapsedMs / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
})

const sinceLastAriaLabel = computed<string | undefined>(() =>
  sinceLastLabel.value ? t('contractions.sinceLast', { time: sinceLastLabel.value }) : undefined,
)

const stats = computed(() => summarizeRecentContractions(babies.contractions, now.value))

function formatStat(seconds: number | null): string {
  if (seconds === null) return '-'
  const minutes = Math.floor(seconds / 60)
  const secs = Math.round(seconds % 60)
  return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

const togglingTimer = ref(false)

async function onToggleTimer() {
  togglingTimer.value = true

  try {
    if (activeContraction.value) {
      await babies.updateContraction(activeContraction.value.id, {
        started_at: activeContraction.value.started_at,
        ended_at: new Date().toISOString(),
        intensity: activeContraction.value.intensity,
      })
    } else {
      await babies.startContraction()
    }
  } catch {
    toast.show(t('contractions.toastError'), 'error')
  } finally {
    togglingTimer.value = false
  }
}

// --- Hoja de edición de una contracción ---

type Sheet = 'editContraction' | 'confirmBreak' | 'hospitalAlert' | 'breakInfo' | null
const activeSheet = ref<Sheet>(null)

function closeSheet() {
  activeSheet.value = null
}

const editingId = ref<number | null>(null)
const editStartedAt = ref('')
const editEndedAt = ref('')
const editIntensity = ref<0 | 1 | 2>(0)
const savingEdit = ref(false)

// Read-only, purely illustrative - recomputed live as the start/end
// fields change, but there's nothing to submit for it: `started_at`/
// `ended_at` are what the backend actually stores, duration is always
// derived from those.
const editDurationLabel = computed(() => {
  if (!editStartedAt.value || !editEndedAt.value) return '--:--:--'

  const totalSeconds = Math.max(
    0,
    Math.round(
      (new Date(editEndedAt.value).getTime() - new Date(editStartedAt.value).getTime()) / 1000,
    ),
  )
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
})

const intensityOptions = computed(() => [
  { value: 0 as const, label: t('contractions.intensity.leve') },
  { value: 1 as const, label: t('contractions.intensity.moderada') },
  { value: 2 as const, label: t('contractions.intensity.intensa') },
])

function openEditSheet(id: number) {
  const contraction = babies.contractions.find((c) => c.id === id)
  if (!contraction) return

  editingId.value = contraction.id
  editStartedAt.value = toLocalInputValueWithSeconds(contraction.started_at)
  editEndedAt.value = contraction.ended_at ? toLocalInputValueWithSeconds(contraction.ended_at) : ''
  editIntensity.value = contraction.intensity
  activeSheet.value = 'editContraction'
}

async function onSaveEdit() {
  if (editingId.value === null) return

  savingEdit.value = true
  try {
    await babies.updateContraction(editingId.value, {
      started_at: toUtcIso(editStartedAt.value),
      ended_at: editEndedAt.value ? toUtcIso(editEndedAt.value) : null,
      intensity: editIntensity.value,
    })
    toast.show(t('contractions.toastUpdated'))
    closeSheet()
  } catch {
    toast.show(t('contractions.toastError'), 'error')
  } finally {
    savingEdit.value = false
  }
}

const deletingEdit = ref(false)

async function onDeleteEdit() {
  if (editingId.value === null) return

  deletingEdit.value = true
  try {
    await babies.deleteContraction(editingId.value)
    toast.show(t('contractions.toastDeleted'))
    closeSheet()
  } catch {
    toast.show(t('contractions.toastError'), 'error')
  } finally {
    deletingEdit.value = false
  }
}

// --- Rotura de bolsa de aguas ---

function onDropletClick() {
  if (babies.current?.water_broke_at) {
    openBreakInfoSheet()
  } else {
    activeSheet.value = 'confirmBreak'
  }
}

const confirmingBreak = ref(false)

async function onConfirmBreak(confirmed: boolean) {
  if (!confirmed) {
    closeSheet()
    return
  }

  confirmingBreak.value = true
  try {
    await babies.updateBaby({ water_broke_at: new Date().toISOString() })
    activeSheet.value = 'hospitalAlert'
  } catch {
    toast.show(t('contractions.toastError'), 'error')
    closeSheet()
  } finally {
    confirmingBreak.value = false
  }
}

const breakDateInput = ref('')
const savingBreak = ref(false)

// Reset (and hospital-alert dismissal) both land back on this sheet with
// the field pre-filled from whatever's already stored, so opening it a
// second time to edit doesn't start from a blank field.
function openBreakInfoSheet() {
  breakDateInput.value = babies.current?.water_broke_at
    ? toLocalInputValue(babies.current.water_broke_at)
    : nowForInput()
  activeSheet.value = 'breakInfo'
}

async function onSaveBreak() {
  savingBreak.value = true
  try {
    await babies.updateBaby({ water_broke_at: toUtcIso(breakDateInput.value) })
    toast.show(t('contractions.toastUpdated'))
    closeSheet()
  } catch {
    toast.show(t('contractions.toastError'), 'error')
  } finally {
    savingBreak.value = false
  }
}

async function onResetBreak() {
  savingBreak.value = true
  try {
    await babies.updateBaby({ water_broke_at: null })
    toast.show(t('contractions.toastReset'))
    closeSheet()
  } catch {
    toast.show(t('contractions.toastError'), 'error')
  } finally {
    savingBreak.value = false
  }
}

// --- Exportar PDF ---

const exporting = ref(false)

async function onExportPdf() {
  exporting.value = true
  try {
    const blob = await babies.exportContractionsPdf()
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'contracciones.pdf'
    link.click()
    URL.revokeObjectURL(url)
  } catch {
    toast.show(t('contractions.exportError'), 'error')
  } finally {
    exporting.value = false
  }
}
</script>

<template>
  <main class="flex flex-1 flex-col gap-5 px-4 py-5 pb-28">
    <div class="flex items-center justify-between">
      <RouterLink
        :to="{ name: 'dashboard' }"
        class="grid h-9 w-9 shrink-0 place-items-center rounded-full text-text-muted transition-colors hover:text-text"
        :aria-label="t('common.back')"
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
      <h1 class="font-display text-lg font-bold">{{ t('contractions.title') }}</h1>
      <button
        type="button"
        class="grid h-9 w-9 shrink-0 place-items-center rounded-full text-text-muted transition-colors hover:text-text disabled:opacity-50"
        :disabled="exporting || babies.contractions.length === 0"
        :aria-label="t('contractions.export')"
        @click="onExportPdf"
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
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <path d="M7 10l5 5 5-5M12 15V3" />
        </svg>
      </button>
    </div>

    <div v-if="loading" class="flex flex-1 items-center justify-center text-text-muted">
      {{ t('common.loading') }}
    </div>

    <div
      v-else-if="loadError"
      class="flex flex-1 flex-col items-center justify-center gap-3 text-center"
    >
      <p role="alert" class="text-sm font-medium text-danger">{{ t('common.loadError') }}</p>
      <button type="button" class="btn-primary" @click="loadContractions">
        {{ t('common.retry') }}
      </button>
    </div>

    <template v-else>
      <div class="card grid grid-cols-3 divide-x divide-border p-5">
        <div class="flex flex-col items-center text-center">
          <div
            class="flex min-h-8 items-center justify-center text-xs leading-tight font-semibold text-text-muted"
          >
            {{ t('contractions.stats.perHour') }}
          </div>
          <div class="mt-1.5 font-display text-xl font-bold tabular-nums text-brand">
            {{ stats.perHour ?? '-' }}
          </div>
        </div>
        <div class="flex flex-col items-center text-center">
          <div
            class="flex min-h-8 items-center justify-center text-xs leading-tight font-semibold text-text-muted"
          >
            {{ t('contractions.stats.avgDuration') }}
          </div>
          <div class="mt-1.5 font-display text-xl font-bold tabular-nums text-brand">
            {{ formatStat(stats.avgDurationSec) }}
          </div>
        </div>
        <div class="flex flex-col items-center text-center">
          <div
            class="flex min-h-8 items-center justify-center text-xs leading-tight font-semibold text-text-muted"
          >
            {{ t('contractions.stats.avgInterval') }}
          </div>
          <div class="mt-1.5 font-display text-xl font-bold tabular-nums text-brand">
            {{ formatStat(stats.avgIntervalSec) }}
          </div>
        </div>
      </div>

      <div v-if="sinceLastLabel" class="flex justify-end">
        <span
          class="rounded-full border border-border px-4 py-1.5 text-base font-bold tabular-nums text-text-muted"
          :aria-label="sinceLastAriaLabel"
        >
          {{ sinceLastLabel }}
        </span>
      </div>

      <ContractionTimeline
        v-if="babies.contractions.length > 0"
        :contractions="babies.contractions"
        :date-locale="dateLocale"
        :now="now"
        @edit="openEditSheet"
      />
      <p
        v-else
        class="rounded-2xl border border-dashed border-border p-4 text-center text-sm text-text-muted"
      >
        {{ t('contractions.empty') }}
      </p>
    </template>

    <!-- Floating over the timeline, pinned to the bottom of the screen -
         same spot as the reference app's own start/stop and water-break
         buttons - not inline above the list. Teleported to <body>, same
         technique as BottomSheet.vue, so a `fixed` position isn't at the
         mercy of some ancestor's `transform` turning it into a
         containing block. -->
    <Teleport v-if="!loading && !loadError" to="body">
      <div
        class="fixed inset-x-0 bottom-0 z-20 mx-auto w-full max-w-md border-t border-border bg-bg/95 px-4 pt-3 backdrop-blur"
        style="padding-bottom: calc(0.75rem + env(safe-area-inset-bottom))"
      >
        <div class="flex items-center gap-2.5">
          <button
            type="button"
            class="flex shrink-0 flex-col items-center gap-0.5 rounded-full border-2 px-4 py-2.5 shadow-sm transition-colors"
            :class="
              babies.current?.water_broke_at
                ? 'border-brand-teal bg-brand-teal text-brand-ink'
                : 'border-brand-teal bg-brand-teal/10 text-brand-teal hover:bg-brand-teal/20'
            "
            @click="onDropletClick"
          >
            <svg
              viewBox="0 0 24 24"
              :fill="babies.current?.water_broke_at ? 'currentColor' : 'none'"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="h-7 w-7"
            >
              <path d="M12 2s7 8.5 7 13a7 7 0 0 1-14 0c0-4.5 7-13 7-13Z" />
            </svg>
            <span
              v-if="babies.current?.water_broke_at"
              class="text-[0.65rem] font-bold leading-tight tabular-nums"
            >
              {{
                new Date(babies.current.water_broke_at).toLocaleTimeString(dateLocale, {
                  hour: '2-digit',
                  minute: '2-digit',
                })
              }}
            </span>
            <span
              v-if="babies.current?.water_broke_at"
              class="text-[0.65rem] font-bold leading-tight tabular-nums"
            >
              {{
                new Date(babies.current.water_broke_at).toLocaleDateString(dateLocale, {
                  day: '2-digit',
                  month: '2-digit',
                })
              }}
            </span>
          </button>

          <button
            type="button"
            :disabled="togglingTimer"
            class="btn-primary flex flex-1 items-center justify-center gap-2 !rounded-full"
            :class="activeContraction ? '!bg-danger' : ''"
            @click="onToggleTimer"
          >
            <svg
              v-if="!activeContraction"
              viewBox="0 0 24 24"
              fill="currentColor"
              class="h-4 w-4"
              aria-hidden="true"
            >
              <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" />
            </svg>
            <svg
              v-else
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              class="h-4 w-4"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="9" />
              <rect x="9" y="9" width="6" height="6" rx="1" fill="currentColor" stroke="none" />
            </svg>
            {{ activeContraction ? t('contractions.stop') : t('contractions.start') }}
          </button>
        </div>
      </div>
    </Teleport>

    <BottomSheet :open="activeSheet === 'editContraction'" @update:open="closeSheet">
      <h3 class="mb-4 font-display text-base font-bold">{{ t('contractions.editTitle') }}</h3>
      <form class="flex flex-col gap-4" @submit.prevent="onSaveEdit">
        <div>
          <label for="contraction-started" class="field-label">{{
            t('contractions.startedAt')
          }}</label>
          <input
            id="contraction-started"
            v-model="editStartedAt"
            type="datetime-local"
            step="1"
            required
            class="field-input"
          />
        </div>
        <div>
          <label for="contraction-ended" class="field-label">{{ t('contractions.endedAt') }}</label>
          <input
            id="contraction-ended"
            v-model="editEndedAt"
            type="datetime-local"
            step="1"
            class="field-input"
          />
        </div>

        <div>
          <span class="field-label">{{ t('contractions.duration') }}</span>
          <p class="field-input font-display tabular-nums text-text-muted">
            {{ editDurationLabel }}
          </p>
        </div>

        <div>
          <span class="field-label">{{ t('contractions.intensityLabel') }}</span>
          <div class="flex flex-col gap-2">
            <button
              v-for="option in intensityOptions"
              :key="option.value"
              type="button"
              class="flex items-center justify-between rounded-xl border-2 px-3 py-2.5 text-left text-sm font-semibold transition-colors"
              :class="
                editIntensity === option.value
                  ? 'border-brand text-text'
                  : 'border-border text-text-muted'
              "
              @click="editIntensity = option.value"
            >
              {{ option.label }}
              <span class="flex gap-0.5">
                <svg
                  v-for="bolt in 3"
                  :key="bolt"
                  viewBox="0 0 24 24"
                  :fill="bolt <= option.value + 1 ? 'currentColor' : 'none'"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  class="h-4 w-4"
                  :class="bolt <= option.value + 1 ? 'text-milestone' : 'text-text-muted'"
                >
                  <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" />
                </svg>
              </span>
            </button>
          </div>
        </div>

        <button type="submit" :disabled="savingEdit" class="btn-primary">
          {{ t('common.save') }}
        </button>
      </form>

      <button
        type="button"
        :disabled="deletingEdit"
        class="mt-5 w-full text-center text-sm font-semibold text-danger"
        @click="onDeleteEdit"
      >
        {{ t('contractions.delete') }}
      </button>
    </BottomSheet>

    <BottomSheet :open="activeSheet === 'confirmBreak'" @update:open="closeSheet">
      <div class="flex flex-col items-center gap-4 py-2 text-center">
        <svg viewBox="0 0 24 24" fill="currentColor" class="h-10 w-10 text-sleep">
          <path d="M12 2s7 8.5 7 13a7 7 0 0 1-14 0c0-4.5 7-13 7-13Z" />
        </svg>
        <h3 class="font-display text-base font-bold">{{ t('contractions.breakConfirmTitle') }}</h3>
        <div class="flex w-full gap-3">
          <button type="button" class="btn-ghost flex-1" @click="onConfirmBreak(false)">
            {{ t('common.no') }}
          </button>
          <button
            type="button"
            :disabled="confirmingBreak"
            class="btn-primary flex-1"
            @click="onConfirmBreak(true)"
          >
            {{ t('common.yes') }}
          </button>
        </div>
      </div>
    </BottomSheet>

    <BottomSheet :open="activeSheet === 'hospitalAlert'" @update:open="closeSheet">
      <div class="flex flex-col items-center gap-3 py-2 text-center">
        <span class="text-4xl" aria-hidden="true">🚑</span>
        <h3 class="font-display text-base font-bold">{{ t('contractions.hospitalTitle') }}</h3>
        <p class="text-sm text-text-muted">{{ t('contractions.hospitalBody') }}</p>
        <button type="button" class="btn-primary w-full" @click="closeSheet">
          {{ t('common.ok') }}
        </button>
      </div>
    </BottomSheet>

    <BottomSheet :open="activeSheet === 'breakInfo'" @update:open="closeSheet">
      <h3 class="mb-4 font-display text-base font-bold">{{ t('contractions.breakInfoTitle') }}</h3>
      <form class="flex flex-col gap-4" @submit.prevent="onSaveBreak">
        <div>
          <label for="water-broke-at" class="field-label">{{
            t('contractions.breakInfoLabel')
          }}</label>
          <input
            id="water-broke-at"
            v-model="breakDateInput"
            type="datetime-local"
            required
            class="field-input"
          />
        </div>
        <div class="flex gap-3">
          <button
            type="button"
            :disabled="savingBreak"
            class="btn-ghost flex-1"
            @click="onResetBreak"
          >
            {{ t('contractions.breakReset') }}
          </button>
          <button type="submit" :disabled="savingBreak" class="btn-primary flex-1">
            {{ t('common.save') }}
          </button>
        </div>
      </form>
    </BottomSheet>
  </main>
</template>
