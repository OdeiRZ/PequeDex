<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import {
  useBabiesStore,
  type BabySex,
  type DiaperChange,
  type DiaperType,
  type Feed,
  type FeedType,
  type GrowthMeasurement,
  type MilestoneCategory,
  type Sleep,
  type TimelineEntry,
} from '@/stores/babies'
import { useToastStore } from '@/stores/toast'
import ActionBar from '@/components/ActionBar.vue'
import AppMark from '@/components/AppMark.vue'
import BottomSheet from '@/components/BottomSheet.vue'
import CategoryIcon from '@/components/CategoryIcon.vue'
import DailyRhythm from '@/components/DailyRhythm.vue'
import DeleteButton from '@/components/DeleteButton.vue'
import EntryCard from '@/components/EntryCard.vue'
import MilestoneStories from '@/components/MilestoneStories.vue'
import MilestoneStoryViewer from '@/components/MilestoneStoryViewer.vue'
import SegmentedControl from '@/components/SegmentedControl.vue'
import TodaySummary from '@/components/TodaySummary.vue'
import WeeklySleep from '@/components/WeeklySleep.vue'
import { ALL_CATEGORIES, categoryBg, categoryText, type Category } from '@/lib/category'
import { milestoneCategories, milestoneCategoryEmoji } from '@/lib/milestoneCategory'
import { nowForInput, toLocalInputValue, toUtcIso } from '@/lib/datetimeInput'
import { getBabyAge } from '@/lib/babyAge'
import { addDays, todayDateOnlyString } from '@/lib/localDate'

const auth = useAuthStore()
const babies = useBabiesStore()
const toast = useToastStore()
const { t, locale } = useI18n()

const dateLocale = computed(() => (locale.value === 'es' ? 'es-ES' : 'en-GB'))

// Nothing logged for a baby can predate its own birth - used as `min` on
// every quick-log date field below. `undefined` (not set) when the baby
// has no birth_date yet, since there's nothing to compare against.
const minDate = computed(() => babies.current?.birth_date ?? undefined)
const minDateTime = computed(() => (minDate.value ? `${minDate.value}T00:00` : undefined))

const loading = ref(true)
const loadError = ref(false)

// Shared by the initial mount and by create/join below - without this,
// joining a baby that already has real history (the whole point of
// joining one instead of starting fresh) left the timeline/growth/
// milestones/prediction empty until a manual reload, since onMounted
// only ever runs once and babies.current turning non-null afterwards
// doesn't re-trigger it. Found live: looked like nothing had synced,
// when the join itself had actually worked.
async function loadBabyData() {
  loading.value = true
  // A baby switch (or fresh load) always lands back on today's rhythm,
  // not wherever the previous baby's navigation happened to be left.
  rhythmDate.value = todayDateOnlyString()

  try {
    await Promise.all([
      babies.fetchTimeline(),
      babies.fetchGrowthMeasurements(),
      babies.fetchMilestones(),
      babies.fetchSleepPrediction(),
      babies.fetchFeedPrediction(),
      babies.fetchRecentSleeps(),
    ])
  } finally {
    loading.value = false
  }
}

// --- "Ritmo": navegación por día ---
//
// `babies.timeline` is always "most recent N overall" (see
// TimelineController) and live-polled every 5s while this view is
// open - exactly right for today, but wrong for a previous day once
// more than that many things have happened since (older entries fall
// off the top-N before they'd ever reach that day). Browsing to a
// previous day fetches that day specifically into `babies.dayTimeline`
// instead, which `rhythmTimeline` below switches to.
const rhythmDate = ref(todayDateOnlyString())
const isRhythmToday = computed(() => rhythmDate.value === todayDateOnlyString())
const rhythmTimeline = computed(() => (isRhythmToday.value ? babies.timeline : babies.dayTimeline))

// The flat "Línea temporal" list below reuses `rhythmTimeline` too - a
// day separator between entries makes sense in both of its modes: on
// "hoy" it's still "most recent N overall", which can span into
// yesterday once N entries have piled up today; on a past day it's a
// single calendar day, so at most one separator ever renders, acting
// as a day label for the whole list. `en-CA` gives a stable
// yyyy-mm-dd grouping key independent of `dateLocale`, which is only
// used for the displayed label - same pattern as ContractionTimeline.vue.
type TimelineListItem =
  | { kind: 'separator'; key: string; label: string }
  | { kind: 'entry'; key: string; entry: TimelineEntry }

const groupedTimeline = computed<TimelineListItem[]>(() => {
  const items: TimelineListItem[] = []
  let previousDayKey: string | null = null

  for (const entry of rhythmTimeline.value) {
    const at = new Date(entry.at)
    const dayKey = at.toLocaleDateString('en-CA')
    if (dayKey !== previousDayKey) {
      items.push({
        kind: 'separator',
        key: `day-${dayKey}`,
        label: at.toLocaleDateString(dateLocale.value, {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        }),
      })
      previousDayKey = dayKey
    }
    items.push({ kind: 'entry', key: `${entry.type}-${entry.data.id}`, entry })
  }

  return items
})

async function onRhythmPrevDay() {
  rhythmDate.value = addDays(rhythmDate.value, -1)
  if (!isRhythmToday.value) {
    await babies.fetchDayTimeline(rhythmDate.value)
  }
}

async function onRhythmNextDay() {
  if (isRhythmToday.value) return

  rhythmDate.value = addDays(rhythmDate.value, 1)
  if (!isRhythmToday.value) {
    await babies.fetchDayTimeline(rhythmDate.value)
  }
}

// Also the retry action below - without a try/catch here, a failed
// fetchCurrent() (offline, or the API "despertando" after ~50s of
// inactivity on Render's free tier, see the README) left `loading` at
// its initial `true` forever: neither branch below ever ran, so the
// user was stuck on the loading screen with no error and no way out
// but a manual page reload.
async function initDashboard() {
  loading.value = true
  loadError.value = false

  try {
    await babies.fetchCurrent()
  } catch {
    loadError.value = true
    loading.value = false

    return
  }

  if (babies.current) {
    // loadBabyData() itself only has a `finally` (its two other callers,
    // onCreateBaby/onJoinBaby, already catch its rejection themselves to
    // show their own createError/joinError instead) - uncaught here, a
    // failed Promise.all (any of timeline/growth/milestones/prediction/
    // sleeps) left `loading` false again via that `finally` but with no
    // error shown, rendering the dashboard shell over silently empty
    // sections instead of the same retry screen as a fetchCurrent()
    // failure above.
    try {
      await loadBabyData()
    } catch {
      loadError.value = true
    }
  } else {
    loading.value = false
  }
}

onMounted(initDashboard)

// --- Onboarding: crear o unirse a un bebé ---

const babyName = ref('')
const dueDate = ref('')
const creatingBaby = ref(false)
const createError = ref<string | null>(null)

async function onCreateBaby() {
  createError.value = null
  creatingBaby.value = true

  try {
    await babies.create({ name: babyName.value || undefined, due_date: dueDate.value || undefined })
    toast.show(t('dashboard.onboarding.toastCreated'))
    closeSheet()
    await loadBabyData()
  } catch {
    createError.value = t('dashboard.onboarding.createError')
  } finally {
    creatingBaby.value = false
  }
}

const inviteCodeInput = ref('')
const joiningBaby = ref(false)
const joinError = ref<string | null>(null)

async function onJoinBaby() {
  joinError.value = null
  joiningBaby.value = true

  try {
    await babies.join(inviteCodeInput.value)
    toast.show(t('dashboard.onboarding.toastJoined'))
    closeSheet()
    await loadBabyData()
  } catch {
    joinError.value = t('dashboard.onboarding.joinError')
  } finally {
    joiningBaby.value = false
  }
}

async function onSwitchBaby(id: number) {
  if (id === babies.current?.id) return

  babies.switchBaby(id)
  await loadBabyData()
}

// --- Sincronización entre cuidadores: sondeo periódico de la línea
// temporal, mismo patrón que el import de BGG en LudoDex - sin
// websockets ni infraestructura nueva. ---
let pollTimer: ReturnType<typeof setInterval> | undefined

onMounted(() => {
  pollTimer = setInterval(async () => {
    if (!babies.current) return

    // Best-effort background sync - a failed poll (offline, API asleep)
    // isn't worth interrupting the user over, the next tick 5s later
    // just tries again. Without this catch, a rejected fetchTimeline()
    // here was an unhandled promise rejection.
    try {
      await babies.fetchTimeline()
    } catch {
      // ignored, see comment above
    }
  }, 5000)
})

onUnmounted(() => {
  clearInterval(pollTimer)
})

// --- Hojas inferiores: una por cada botón de la barra de acciones, más
// el ajuste de sexo/fecha de nacimiento del bebé. ---

type Sheet = Category | 'settings' | 'addBaby' | null
const activeSheet = ref<Sheet>(null)

function openSheet(sheet: Exclude<Sheet, null>) {
  if (sheet === 'feed') {
    feedType.value = 'pecho'
    feedSide.value = 'izquierdo'
    feedAmountMl.value = ''
    feedStartedAt.value = nowForInput()
    editingFeedId.value = null
  } else if (sheet === 'sleep') {
    sleepStartedAt.value = nowForInput()
    sleepEndedAt.value = ''
    editingSleepId.value = null
  } else if (sheet === 'diaper') {
    diaperType.value = 'mojado'
    diaperChangedAt.value = nowForInput()
    editingDiaperId.value = null
  } else if (sheet === 'growth') {
    growthMeasuredAt.value = new Date().toISOString().slice(0, 10)
    growthWeightKg.value = ''
    growthHeightCm.value = ''
    growthHeadCircumferenceCm.value = ''
    growthError.value = null
    editingGrowthId.value = null
  } else if (sheet === 'milestone') {
    milestoneAchievedAt.value = new Date().toISOString().slice(0, 10)
    milestoneCategory.value = null
    milestoneTitle.value = ''
    milestoneDescription.value = ''
    milestonePhoto.value = null
    editingMilestoneId.value = null
    milestoneExistingPhotoUrl.value = null
    milestoneRemovePhoto.value = false
    lastSuggestedTitle.value = ''
  } else if (sheet === 'settings') {
    babySex.value = babies.current?.sex ?? ''
    babyBirthDate.value = babies.current?.birth_date ?? ''
    confirmingLeave.value = false
    leaveError.value = null
    confirmingDeleteContractions.value = false
    deleteContractionsError.value = null
  } else if (sheet === 'addBaby') {
    babyName.value = ''
    dueDate.value = ''
    createError.value = null
    inviteCodeInput.value = ''
    joinError.value = null
  }

  activeSheet.value = sheet
}

function closeSheet() {
  activeSheet.value = null
}

// null en el usuario = las 5 visibles (valor por defecto, sin
// personalizar) - el mismo significado que usa el backend.
const enabledCategories = computed<Category[]>(
  () => auth.user?.action_bar_categories ?? [...ALL_CATEGORIES],
)

const actionBarItems = computed(() => {
  const allItems: { category: Category; label: string }[] = [
    { category: 'feed', label: t('dashboard.quickLog.feed') },
    { category: 'sleep', label: t('dashboard.quickLog.sleep') },
    { category: 'diaper', label: t('dashboard.quickLog.diaper') },
    { category: 'growth', label: t('dashboard.quickLog.growth') },
    { category: 'milestone', label: t('dashboard.quickLog.milestone') },
  ]
  return allItems.filter((item) => enabledCategories.value.includes(item.category))
})

// --- Registro rápido: toma ---

const feedType = ref<FeedType>('pecho')
const feedSide = ref<'izquierdo' | 'derecho' | 'ambos'>('izquierdo')
const feedAmountMl = ref('')
const feedStartedAt = ref('')
const savingFeed = ref(false)

// null while creating a new feed; the id of the one being edited
// otherwise - same convention as editingMilestoneId.
const editingFeedId = ref<number | null>(null)

const feedTypeOptions = computed(() => [
  { value: 'biberon' as const, label: t('dashboard.feedForm.bottle') },
  { value: 'pecho' as const, label: t('dashboard.feedForm.breast') },
  { value: 'solido' as const, label: t('dashboard.feedForm.solid') },
])

const feedSideOptions = computed(() => [
  { value: 'izquierdo' as const, label: t('dashboard.feedForm.left') },
  { value: 'derecho' as const, label: t('dashboard.feedForm.right') },
  { value: 'ambos' as const, label: t('dashboard.feedForm.both') },
])

function openFeedEdit(feed: Feed) {
  editingFeedId.value = feed.id
  feedType.value = feed.type
  feedSide.value = feed.side ?? 'izquierdo'
  feedAmountMl.value = feed.amount_ml?.toString() ?? ''
  feedStartedAt.value = toLocalInputValue(feed.started_at)
  activeSheet.value = 'feed'
}

async function onSubmitFeed() {
  savingFeed.value = true

  try {
    const payload = {
      type: feedType.value,
      side: feedType.value === 'pecho' ? feedSide.value : undefined,
      amount_ml: feedType.value === 'biberon' ? Number(feedAmountMl.value) : undefined,
      started_at: toUtcIso(feedStartedAt.value),
    }

    if (editingFeedId.value) {
      await babies.updateFeed(editingFeedId.value, payload)
      toast.show(t('dashboard.feedForm.toastUpdated'))
    } else {
      await babies.createFeed(payload)
    }
    // Fire-and-forget: the prediction is a nice-to-have next to the
    // save that already succeeded (the timeline entry is there
    // regardless), so a failed refresh here shouldn't surface as a
    // save error - it'll just catch up on the next visit or poll.
    void babies.fetchFeedPrediction().catch(() => {})
    closeSheet()
  } catch {
    toast.show(t('dashboard.saveError'), 'error')
  } finally {
    savingFeed.value = false
  }
}

// --- Registro rápido: sueño ---

const sleepStartedAt = ref('')
const sleepEndedAt = ref('')
const savingSleep = ref(false)
const editingSleepId = ref<number | null>(null)

function openSleepEdit(sleep: Sleep) {
  editingSleepId.value = sleep.id
  sleepStartedAt.value = toLocalInputValue(sleep.started_at)
  sleepEndedAt.value = sleep.ended_at ? toLocalInputValue(sleep.ended_at) : ''
  activeSheet.value = 'sleep'
}

async function onSubmitSleep() {
  savingSleep.value = true

  try {
    const payload = {
      started_at: toUtcIso(sleepStartedAt.value),
      ended_at: sleepEndedAt.value ? toUtcIso(sleepEndedAt.value) : null,
    }

    if (editingSleepId.value) {
      await babies.updateSleep(editingSleepId.value, payload)
      toast.show(t('dashboard.sleepForm.toastUpdated'))
    } else {
      await babies.createSleep(payload)
    }
    // Fire-and-forget, same reasoning as onSubmitFeed's prediction
    // refresh: the save already succeeded, a failed refresh here
    // shouldn't surface as a save error.
    void babies.fetchSleepPrediction().catch(() => {})
    closeSheet()
  } catch {
    toast.show(t('dashboard.saveError'), 'error')
  } finally {
    savingSleep.value = false
  }
}

// --- Registro rápido: pañal ---

const diaperType = ref<DiaperType>('mojado')
const diaperChangedAt = ref('')
const savingDiaper = ref(false)
const editingDiaperId = ref<number | null>(null)

const diaperTypeOptions = computed(() => [
  { value: 'mojado' as const, label: t('dashboard.diaperForm.wet') },
  { value: 'sucio' as const, label: t('dashboard.diaperForm.dirty') },
  { value: 'ambos' as const, label: t('dashboard.diaperForm.both') },
])

function openDiaperEdit(diaperChange: DiaperChange) {
  editingDiaperId.value = diaperChange.id
  diaperType.value = diaperChange.type
  diaperChangedAt.value = toLocalInputValue(diaperChange.changed_at)
  activeSheet.value = 'diaper'
}

async function onSubmitDiaper() {
  savingDiaper.value = true

  try {
    const payload = {
      changed_at: toUtcIso(diaperChangedAt.value),
      type: diaperType.value,
    }

    if (editingDiaperId.value) {
      await babies.updateDiaperChange(editingDiaperId.value, payload)
      toast.show(t('dashboard.diaperForm.toastUpdated'))
    } else {
      await babies.createDiaperChange(payload)
    }
    closeSheet()
  } catch {
    toast.show(t('dashboard.saveError'), 'error')
  } finally {
    savingDiaper.value = false
  }
}

// Backend values (izquierdo/derecho/ambos, mojado/sucio/ambos) stay in
// Spanish regardless of UI language - they're internal enum values, not
// display text - so the timeline translates them for display here.
const sideLabels = computed<Record<string, string>>(() => ({
  izquierdo: t('dashboard.feedForm.left'),
  derecho: t('dashboard.feedForm.right'),
  ambos: t('dashboard.feedForm.both'),
}))

const diaperTypeLabels = computed<Record<string, string>>(() => ({
  mojado: t('dashboard.diaperForm.wet'),
  sucio: t('dashboard.diaperForm.dirty'),
  ambos: t('dashboard.diaperForm.both'),
}))

function entryCategory(entry: (typeof babies.timeline)[number]): Category {
  return entry.type === 'diaper_change' ? 'diaper' : entry.type
}

function entryTitle(entry: (typeof babies.timeline)[number]): string {
  if (entry.type === 'feed') {
    if (entry.data.type === 'biberon') {
      return t('dashboard.timeline.bottleSummary', { amount: entry.data.amount_ml })
    }
    if (entry.data.type === 'pecho') {
      return t('dashboard.timeline.breastSummary', {
        side: sideLabels.value[entry.data.side ?? ''] ?? entry.data.side,
      })
    }
    return t('dashboard.timeline.solidSummary')
  }

  if (entry.type === 'sleep') {
    return entry.data.ended_at
      ? t('dashboard.timeline.sleepDone')
      : t('dashboard.timeline.sleepOngoing')
  }

  return t('dashboard.timeline.diaperSummary', {
    type: diaperTypeLabels.value[entry.data.type] ?? entry.data.type,
  })
}

async function onDeleteEntry(entry: (typeof babies.timeline)[number]) {
  const key = entry.type === 'diaper_change' ? 'diaper' : entry.type

  try {
    if (entry.type === 'feed') {
      await babies.deleteFeed(entry.data.id)
      void babies.fetchFeedPrediction().catch(() => {})
    } else if (entry.type === 'sleep') {
      await babies.deleteSleep(entry.data.id)
      void babies.fetchSleepPrediction().catch(() => {})
    } else {
      await babies.deleteDiaperChange(entry.data.id)
    }
    toast.show(t(`dashboard.toastRemoved.${key}`))
  } catch {
    toast.show(t(`dashboard.removeError.${key}`), 'error')
  }
}

function onOpenEntry(entry: (typeof babies.timeline)[number]) {
  if (entry.type === 'feed') {
    openFeedEdit(entry.data)
  } else if (entry.type === 'sleep') {
    openSleepEdit(entry.data)
  } else {
    openDiaperEdit(entry.data)
  }
}

async function onDeleteGrowthMeasurement(id: number) {
  try {
    await babies.deleteGrowthMeasurement(id)
    toast.show(t('dashboard.toastRemoved.growth'))
  } catch {
    toast.show(t('dashboard.removeError.growth'), 'error')
  }
}

async function onDeleteMilestone(id: number) {
  try {
    await babies.deleteMilestone(id)
    toast.show(t('dashboard.toastRemoved.milestone'))
  } catch {
    toast.show(t('dashboard.removeError.milestone'), 'error')
  }
}

// --- Detalle de un hito: visor a pantalla completa estilo "stories", no
// la hoja de "+ Hito" (esa es solo el formulario). Se guarda el id, no el
// objeto, para que sobreviva a un refetch de la lista (tras dar/quitar un
// "me encanta", por ejemplo) - si el id ya no existe (se borró desde el
// otro cuidador), el computed da undefined y el visor se cierra solo. ---

const viewingMilestoneId = ref<number | null>(null)

const viewingMilestoneIndex = computed(() =>
  viewingMilestoneId.value === null
    ? -1
    : babies.milestones.findIndex((m) => m.id === viewingMilestoneId.value),
)

const viewingMilestone = computed(() =>
  viewingMilestoneIndex.value === -1 ? null : babies.milestones[viewingMilestoneIndex.value],
)

const isLikedByMe = computed(
  () => viewingMilestone.value?.liked_by.some((u) => u.id === auth.user?.id) ?? false,
)

function closeMilestoneDetail() {
  viewingMilestoneId.value = null
}

function goToPrevMilestone() {
  const index = viewingMilestoneIndex.value
  const prev = index > 0 ? babies.milestones[index - 1] : undefined
  if (prev) viewingMilestoneId.value = prev.id
}

function goToNextMilestone() {
  const index = viewingMilestoneIndex.value
  const next = index !== -1 ? babies.milestones[index + 1] : undefined
  if (next) viewingMilestoneId.value = next.id
}

async function onDeleteViewingMilestone() {
  if (!viewingMilestone.value) return

  const id = viewingMilestone.value.id
  closeMilestoneDetail()
  await onDeleteMilestone(id)
}

async function onToggleMilestoneLike() {
  if (!viewingMilestone.value) return

  try {
    await babies.toggleMilestoneLike(viewingMilestone.value.id)
  } catch {
    toast.show(t('dashboard.milestones.likeError'), 'error')
  }
}

const inviteCode = computed(() => babies.current?.invite_code ?? '')

// Colapsado siempre al entrar - solo hace falta una vez, al vincular al
// otro cuidador, y ocupar espacio fijo en cada visita (que es constante,
// para el registro rápido) no compensa. No se recuerda entre visitas.
const inviteCodeExpanded = ref(false)

// --- Datos del bebé: sexo y fecha de nacimiento, necesarios para los
// percentiles de crecimiento OMS. Ambos opcionales - si faltan, el
// backend simplemente no calcula percentiles. ---

const babySex = ref<BabySex | ''>('')
const babyBirthDate = ref('')
const savingBabySettings = ref(false)
const confirmingLeave = ref(false)
const leaving = ref(false)
const leaveError = ref<string | null>(null)

const babySexOptions = computed(() => [
  { value: '' as const, label: t('dashboard.babySettings.sexUnknown') },
  { value: 'nino' as const, label: t('dashboard.babySettings.sexBoy') },
  { value: 'nina' as const, label: t('dashboard.babySettings.sexGirl') },
])

// --- Cabecera "Hoy con {nombre}": edad en días/semanas si ya ha nacido,
// cuenta atrás a la fecha prevista si no, o solo el nombre si no hay
// ninguna de las dos fechas todavía (ambas son opcionales al crear el
// bebé). Días para un recién nacido (lo que de verdad importa las dos
// primeras semanas), semanas después - mismo umbral que usan las apps
// de seguimiento reales. ---

const babyAgeInfo = computed(() =>
  getBabyAge(babies.current?.birth_date ?? null, babies.current?.due_date ?? null),
)

// Covers both "no birth_date at all" and "birth_date set but still in
// the future" (a date picked ahead of time, or a due date entered into
// the wrong field) - either way there's no baby to track feeds/sleep/
// diapers/growth/milestones for yet, so everything below the
// contractions link card stays hidden until this is true.
const isBorn = computed(() => babyAgeInfo.value.type === 'born')

const heroEyebrow = computed(() =>
  babies.current?.name
    ? t('dashboard.hero.eyebrow', { name: babies.current.name })
    : t('dashboard.hero.eyebrowGeneric'),
)

interface HeroHeadline {
  value: number | null
  unit: string | null
  special: string | null
}

const heroHeadline = computed<HeroHeadline>(() => {
  const info = babyAgeInfo.value

  if (info.type === 'born') {
    return info.days < 14
      ? { value: info.days, unit: t('dashboard.hero.ageDaysUnit', info.days), special: null }
      : { value: info.weeks, unit: t('dashboard.hero.ageWeeksUnit', info.weeks), special: null }
  }

  if (info.type === 'expecting') {
    return info.daysUntilDue === 0
      ? { value: null, unit: null, special: t('dashboard.hero.countdownToday') }
      : {
          value: info.daysUntilDue,
          unit: t('dashboard.hero.ageDaysUnit', info.daysUntilDue),
          special: null,
        }
  }

  return { value: null, unit: null, special: null }
})

// "7 de septiembre de 2026" instead of "7/9/2026" - the one date on the
// card meant to be read as a headline, not scanned as a data table.
const heroDateFormat: Intl.DateTimeFormatOptions = {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
}

const heroDateLabel = computed(() => {
  if (babyAgeInfo.value.type === 'born' && babies.current?.birth_date) {
    const date = new Date(babies.current.birth_date).toLocaleDateString(
      dateLocale.value,
      heroDateFormat,
    )
    return t('dashboard.hero.bornOn', { date })
  }

  if (babyAgeInfo.value.type === 'expecting' && babies.current?.due_date) {
    const date = new Date(babies.current.due_date).toLocaleDateString(
      dateLocale.value,
      heroDateFormat,
    )
    return t('dashboard.hero.dueOn', { date })
  }

  return null
})

const heroSexLabel = computed(() => {
  if (babies.current?.sex === 'nino') return t('dashboard.hero.sexBoy')
  if (babies.current?.sex === 'nina') return t('dashboard.hero.sexGirl')
  return null
})

const babySettingsButtonLabel = computed(() => {
  if (!babies.current) return t('dashboard.babySettingsButton')

  const parts: string[] = []

  if (babies.current.sex === 'nino') parts.push(t('dashboard.babySettings.sexBoy'))
  if (babies.current.sex === 'nina') parts.push(t('dashboard.babySettings.sexGirl'))
  if (babies.current.birth_date) {
    parts.push(new Date(babies.current.birth_date).toLocaleDateString(dateLocale.value))
  }

  return parts.length > 0 ? parts.join(' · ') : t('dashboard.babySettingsButton')
})

// Retints the brand accent (see base.css) as soon as a sex is picked in
// the segmented control - not just after "Guardar" - by reading the
// live form value while the settings sheet is open, falling back to the
// saved value the rest of the time. "combo" blends both sex themes for
// when no sex is set (or, in jest, for twins of both sexes).
const themeSex = computed<'nino' | 'nina' | 'combo' | null>(() => {
  if (activeSheet.value === 'settings') {
    return babySex.value === 'nino' || babySex.value === 'nina' ? babySex.value : 'combo'
  }

  if (!babies.current) return null

  return babies.current.sex === 'nino' || babies.current.sex === 'nina'
    ? babies.current.sex
    : 'combo'
})

watch(
  themeSex,
  (sex) => {
    if (sex) {
      document.documentElement.setAttribute('data-sex', sex)
    } else {
      document.documentElement.removeAttribute('data-sex')
    }
  },
  { immediate: true },
)

onUnmounted(() => {
  document.documentElement.removeAttribute('data-sex')
})

async function onSaveBabySettings() {
  savingBabySettings.value = true

  try {
    await babies.updateBaby({
      sex: babySex.value || null,
      birth_date: babyBirthDate.value || null,
    })
    closeSheet()
    toast.show(t('dashboard.babySettings.toastSaved'))
  } finally {
    savingBabySettings.value = false
  }
}

async function onLeaveBaby() {
  leaving.value = true
  leaveError.value = null

  try {
    await babies.leave()
    closeSheet()
    confirmingLeave.value = false
    toast.show(t('dashboard.babySettings.toastLeft'))
  } catch {
    // The only real-world reason this fails is being the sole remaining
    // caregiver (422) - one fixed message covers it, same "no per-field
    // backend errors" convention as the rest of this app.
    leaveError.value = t('dashboard.babySettings.leaveError')
  } finally {
    leaving.value = false
  }
}

function cancelLeaveBaby() {
  confirmingLeave.value = false
  leaveError.value = null
}

// --- Eliminar todas las contracciones: reinicio tras una falsa alarma,
// no una acción por fila. Mismo patrón de confirmación que abandonar
// el bebé, con su propio estado - no tiene sentido compartirlo, son
// dos confirmaciones independientes que podrían coexistir en la misma
// hoja. ---

const confirmingDeleteContractions = ref(false)
const deletingContractions = ref(false)
const deleteContractionsError = ref<string | null>(null)

async function onDeleteAllContractions() {
  deletingContractions.value = true
  deleteContractionsError.value = null

  try {
    await babies.deleteAllContractions()
    confirmingDeleteContractions.value = false
    toast.show(t('dashboard.babySettings.toastContractionsDeleted'))
  } catch {
    deleteContractionsError.value = t('dashboard.babySettings.deleteAllContractionsError')
  } finally {
    deletingContractions.value = false
  }
}

function cancelDeleteAllContractions() {
  confirmingDeleteContractions.value = false
  deleteContractionsError.value = null
}

async function onRegenerateInviteCode() {
  try {
    await babies.regenerateInviteCode()
    toast.show(t('dashboard.toastInviteRegenerated'))
  } catch {
    toast.show(t('dashboard.inviteCodeError'), 'error')
  }
}

// --- Crecimiento: peso / talla / perímetro craneal, con percentil OMS
// calculado por el backend cuando el bebé tiene sexo y fecha de
// nacimiento. ---

const growthMeasuredAt = ref('')
const growthWeightKg = ref('')
const growthHeightCm = ref('')
const growthHeadCircumferenceCm = ref('')
const savingGrowth = ref(false)
const growthError = ref<string | null>(null)
const editingGrowthId = ref<number | null>(null)

function openGrowthEdit(measurement: GrowthMeasurement) {
  editingGrowthId.value = measurement.id
  growthMeasuredAt.value = measurement.measured_at.slice(0, 10)
  growthWeightKg.value = measurement.weight_grams
    ? (measurement.weight_grams / 1000).toString()
    : ''
  growthHeightCm.value = measurement.height_cm?.toString() ?? ''
  growthHeadCircumferenceCm.value = measurement.head_circumference_cm?.toString() ?? ''
  growthError.value = null
  activeSheet.value = 'growth'
}

async function onSubmitGrowth() {
  savingGrowth.value = true
  growthError.value = null

  try {
    const payload = {
      measured_at: growthMeasuredAt.value,
      weight_grams: growthWeightKg.value
        ? Math.round(Number(growthWeightKg.value) * 1000)
        : undefined,
      height_cm: growthHeightCm.value ? Number(growthHeightCm.value) : undefined,
      head_circumference_cm: growthHeadCircumferenceCm.value
        ? Number(growthHeadCircumferenceCm.value)
        : undefined,
    }

    if (editingGrowthId.value) {
      await babies.updateGrowthMeasurement(editingGrowthId.value, payload)
      toast.show(t('dashboard.growthForm.toastUpdated'))
    } else {
      await babies.createGrowthMeasurement(payload)
    }
    closeSheet()
  } catch {
    growthError.value = t('dashboard.growthForm.error')
  } finally {
    savingGrowth.value = false
  }
}

function formatPercentile(value: number | null): string {
  return value === null
    ? t('dashboard.growth.noPercentile')
    : t('dashboard.growth.percentile', { value })
}

function growthTitle(measurement: (typeof babies.growthMeasurements)[number]): string {
  const parts: string[] = []

  if (measurement.weight_grams) {
    const weightKg = parseFloat((measurement.weight_grams / 1000).toFixed(2))
    parts.push(`${weightKg} kg (${formatPercentile(measurement.weight_percentile)})`)
  }
  if (measurement.height_cm) {
    parts.push(`${measurement.height_cm} cm (${formatPercentile(measurement.height_percentile)})`)
  }
  if (measurement.head_circumference_cm) {
    parts.push(
      `${t('dashboard.growth.headCircumferenceShort')} ${measurement.head_circumference_cm} cm (${formatPercentile(measurement.head_circumference_percentile)})`,
    )
  }

  return parts.join(' · ')
}

// --- Hitos con foto ---

const milestoneAchievedAt = ref('')
const milestoneCategory = ref<MilestoneCategory | null>(null)
const milestoneTitle = ref('')
const milestoneDescription = ref('')
const milestonePhoto = ref<File | null>(null)
const savingMilestone = ref(false)

// null while creating a new milestone; the id of the one being edited
// otherwise. openSheet('milestone') always resets this to null, so
// opening "+ Hito" fresh from the action bar never stays stuck in edit
// mode from a previous edit.
const editingMilestoneId = ref<number | null>(null)
const milestoneExistingPhotoUrl = ref<string | null>(null)
const milestoneRemovePhoto = ref(false)

// Tracks the last title we auto-filled from a category pick, so picking a
// category suggests a title without ever overwriting one the user already
// typed themselves - only replace the field while it still holds our own
// last suggestion (or is empty).
const lastSuggestedTitle = ref('')

const milestoneDescriptionPrompt = computed(() =>
  t(`dashboard.milestoneForm.categoryPrompts.${milestoneCategory.value ?? 'otro'}`),
)

function selectMilestoneCategory(category: MilestoneCategory) {
  milestoneCategory.value = milestoneCategory.value === category ? null : category

  if (milestoneTitle.value !== '' && milestoneTitle.value !== lastSuggestedTitle.value) {
    return
  }

  const suggestion =
    milestoneCategory.value && milestoneCategory.value !== 'otro'
      ? t(`dashboard.milestoneForm.categoryTitles.${milestoneCategory.value}`)
      : ''
  milestoneTitle.value = suggestion
  lastSuggestedTitle.value = suggestion
}

function onMilestonePhotoChange(event: Event) {
  const input = event.target as HTMLInputElement
  milestonePhoto.value = input.files?.[0] ?? null
  if (milestonePhoto.value) {
    milestoneRemovePhoto.value = false
  }
}

function openMilestoneEdit(milestone: (typeof babies.milestones)[number]) {
  editingMilestoneId.value = milestone.id
  milestoneAchievedAt.value = milestone.achieved_at
  milestoneCategory.value = milestone.category
  milestoneTitle.value = milestone.title
  lastSuggestedTitle.value = ''
  milestoneDescription.value = milestone.description ?? ''
  milestonePhoto.value = null
  milestoneExistingPhotoUrl.value = milestone.photo_url
  milestoneRemovePhoto.value = false
  viewingMilestoneId.value = null
  activeSheet.value = 'milestone'
}

async function onSubmitMilestone() {
  savingMilestone.value = true

  try {
    if (editingMilestoneId.value) {
      await babies.updateMilestone(editingMilestoneId.value, {
        achieved_at: milestoneAchievedAt.value,
        category: milestoneCategory.value,
        title: milestoneTitle.value,
        description: milestoneDescription.value || undefined,
        photo: milestonePhoto.value,
        removePhoto: milestoneRemovePhoto.value,
      })
      toast.show(t('dashboard.milestoneForm.toastUpdated'))
    } else {
      await babies.createMilestone({
        achieved_at: milestoneAchievedAt.value,
        category: milestoneCategory.value,
        title: milestoneTitle.value,
        description: milestoneDescription.value || undefined,
        photo: milestonePhoto.value,
      })
    }
    closeSheet()
  } catch {
    toast.show(t('dashboard.saveError'), 'error')
  } finally {
    savingMilestone.value = false
  }
}

// --- Predicción de patrones de sueño ---

const sleepPredictionLabel = computed(() => {
  const prediction = babies.sleepPrediction

  if (!prediction || !prediction.has_enough_data) {
    return t('dashboard.sleepPrediction.insufficientData', {
      sample: prediction?.sample_size ?? 0,
      minimum: prediction?.minimum_sample_size ?? 3,
    })
  }

  if (!prediction.prediction) {
    return t('dashboard.sleepPrediction.noPattern')
  }

  const at = new Date(prediction.prediction.at).toLocaleString(dateLocale.value)

  return prediction.prediction.type === 'wake_up'
    ? t('dashboard.sleepPrediction.wakeUp', { at })
    : t('dashboard.sleepPrediction.nextSleep', { at })
})

// --- Predicción de patrones de toma ---

const feedPredictionLabel = computed(() => {
  const prediction = babies.feedPrediction

  if (!prediction || !prediction.has_enough_data) {
    return t('dashboard.feedPrediction.insufficientData', {
      sample: prediction?.sample_size ?? 0,
      minimum: prediction?.minimum_sample_size ?? 3,
    })
  }

  if (!prediction.prediction) {
    return t('dashboard.feedPrediction.noPattern')
  }

  const at = new Date(prediction.prediction.at).toLocaleString(dateLocale.value)

  return t('dashboard.feedPrediction.nextFeed', { at })
})
</script>

<template>
  <div
    v-if="loading"
    class="flex flex-1 flex-col items-center justify-center gap-4 text-text-muted"
  >
    <AppMark full animated :size="72" />
    {{ t('common.loading') }}
  </div>

  <div
    v-else-if="loadError"
    class="flex flex-1 flex-col items-center justify-center gap-4 text-center"
  >
    <p role="alert" class="text-sm font-medium text-danger">{{ t('common.loadError') }}</p>
    <button type="button" class="btn-primary" @click="initDashboard">
      {{ t('common.retry') }}
    </button>
  </div>

  <template v-else>
    <main v-if="!babies.current" class="flex flex-1 flex-col gap-6 px-4 py-6">
      <section class="card flex flex-col gap-4 p-5">
        <h2 class="font-display text-lg font-bold">{{ t('dashboard.onboarding.createTitle') }}</h2>
        <form class="flex flex-col gap-4" @submit.prevent="onCreateBaby">
          <div>
            <label for="baby-name" class="field-label">{{ t('dashboard.onboarding.name') }}</label>
            <input id="baby-name" v-model="babyName" type="text" class="field-input" />
          </div>
          <div>
            <label for="due-date" class="field-label">{{
              t('dashboard.onboarding.dueDate')
            }}</label>
            <input id="due-date" v-model="dueDate" type="date" class="field-input" />
          </div>
          <p v-if="createError" role="alert" class="text-sm font-medium text-danger">
            {{ createError }}
          </p>
          <button type="submit" :disabled="creatingBaby" class="btn-primary">
            {{ t('dashboard.onboarding.create') }}
          </button>
        </form>
      </section>

      <section class="card flex flex-col gap-4 p-5">
        <h2 class="font-display text-lg font-bold">{{ t('dashboard.onboarding.joinTitle') }}</h2>
        <form class="flex flex-col gap-4" @submit.prevent="onJoinBaby">
          <div>
            <label for="invite-code" class="field-label">{{
              t('dashboard.onboarding.inviteCode')
            }}</label>
            <input
              id="invite-code"
              v-model="inviteCodeInput"
              type="text"
              required
              class="field-input uppercase tracking-widest"
            />
          </div>
          <p v-if="joinError" role="alert" class="text-sm font-medium text-danger">
            {{ joinError }}
          </p>
          <button type="submit" :disabled="joiningBaby" class="btn-primary">
            {{ t('dashboard.onboarding.join') }}
          </button>
        </form>
      </section>
    </main>

    <template v-else>
      <main class="flex flex-1 flex-col gap-6 px-4 py-5 pb-28">
        <div v-if="babies.babies.length > 1" class="-mb-2 flex gap-2 overflow-x-auto pb-1">
          <button
            v-for="baby in babies.babies"
            :key="baby.id"
            type="button"
            class="shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold transition-[transform,background-color,color] duration-150 active:scale-95"
            :class="
              baby.id === babies.current?.id
                ? 'bg-brand text-brand-ink shadow-sm'
                : 'bg-surface text-text-muted hover:text-text'
            "
            @click="onSwitchBaby(baby.id)"
          >
            {{ baby.name || t('dashboard.babySwitcher.unnamed') }}
          </button>
        </div>

        <div
          class="relative overflow-hidden rounded-2xl p-5 text-brand-ink shadow-md"
          style="background: linear-gradient(155deg, var(--brand) 0%, var(--brand-teal) 130%)"
        >
          <span
            aria-hidden="true"
            class="pointer-events-none absolute -top-14 -right-8 h-36 w-36 rounded-full bg-white/15"
          ></span>
          <span
            aria-hidden="true"
            class="pointer-events-none absolute -bottom-9 left-1/4 h-20 w-20 rounded-full bg-white/10"
          ></span>

          <div class="absolute top-5 right-5 z-10 flex items-center gap-1.5">
            <button
              type="button"
              class="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/20"
              :aria-label="babySettingsButtonLabel"
              @click="openSheet('settings')"
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
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
              </svg>
            </button>
            <span
              v-if="heroSexLabel"
              class="inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-1 text-xs font-bold"
            >
              {{ heroSexLabel }}
            </span>
          </div>

          <button
            type="button"
            class="relative flex w-full flex-col items-start gap-1 text-left"
            :aria-expanded="inviteCodeExpanded"
            @click="inviteCodeExpanded = !inviteCodeExpanded"
          >
            <span
              class="flex items-center gap-1 pr-24 text-xs font-semibold tracking-wide text-brand-ink/80 uppercase"
            >
              {{ heroEyebrow }}
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                class="h-3.5 w-3.5 shrink-0 transition-transform"
                :class="{ 'rotate-180': inviteCodeExpanded }"
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </span>

            <span class="flex w-full items-baseline justify-between gap-2">
              <span
                v-if="heroHeadline.special"
                class="font-display text-2xl font-extrabold text-balance"
              >
                {{ heroHeadline.special }}
              </span>
              <span v-else-if="heroHeadline.value !== null" class="flex items-baseline gap-1.5">
                <span class="font-display text-4xl leading-none font-extrabold">{{
                  heroHeadline.value
                }}</span>
                <span class="font-display text-base font-bold">{{ heroHeadline.unit }}</span>
              </span>
              <span v-else class="font-display text-xl font-bold text-balance">
                {{ babies.current.name ?? t('dashboard.defaultBabyName') }}
              </span>

              <span v-if="heroDateLabel" class="text-xs whitespace-nowrap text-brand-ink/85">{{
                heroDateLabel
              }}</span>
            </span>
          </button>
          <div
            v-if="inviteCodeExpanded"
            class="relative mt-3 flex items-center justify-between gap-2 rounded-xl bg-white/15 px-3 py-2 text-sm"
          >
            <span>{{ t('dashboard.inviteCodeLabel') }}</span>
            <div class="flex items-center gap-2">
              <code class="font-bold tracking-wider tabular-nums">{{ inviteCode }}</code>
              <button
                type="button"
                class="text-xs font-semibold underline underline-offset-2"
                @click="onRegenerateInviteCode"
              >
                {{ t('dashboard.regenerateInviteCode') }}
              </button>
            </div>
          </div>
        </div>

        <RouterLink
          v-if="babies.current && !isBorn"
          :to="{ name: 'contractions' }"
          class="card-interactive flex items-center gap-3 rounded-2xl p-4"
        >
          <span
            class="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-sleep/15 text-sleep"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" class="h-5 w-5">
              <path
                d="M15,1H9V3H15V1M11,14H13V8H11V14M19.03,7.39L20.45,5.97C20,5.46 19.55,5 19.04,4.56L17.62,6C16.07,4.74 14.12,4 12,4A9,9 0 0,0 3,13A9,9 0 0,0 12,22C17,22 21,17.97 21,13C21,10.88 20.26,8.93 19.03,7.39M12,20A7,7 0 0,1 5,13A7,7 0 0,1 12,6A7,7 0 0,1 19,13A7,7 0 0,1 12,20Z"
              />
            </svg>
          </span>
          <div class="min-w-0 flex-1">
            <div class="text-sm font-semibold">{{ t('contractions.linkCardTitle') }}</div>
            <div class="text-xs text-text-muted">{{ t('contractions.linkCardBody') }}</div>
          </div>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="h-4 w-4 shrink-0 text-text-muted"
          >
            <path d="M9 18l6-6-6-6" />
          </svg>
        </RouterLink>

        <template v-if="isBorn">
          <TodaySummary :timeline="babies.timeline" :enabled-categories="enabledCategories" />

          <section v-if="enabledCategories.includes('milestone')" class="flex flex-col gap-2">
            <h2 class="flex items-center gap-2 font-display text-base font-bold">
              <span class="h-4 w-1.5 shrink-0 rounded-full bg-milestone"></span>
              {{ t('dashboard.milestones.title') }}
            </h2>
            <MilestoneStories
              :milestones="babies.milestones"
              @open="viewingMilestoneId = $event"
              @create="openSheet('milestone')"
            />
          </section>

          <DailyRhythm
            :timeline="rhythmTimeline"
            :date-locale="dateLocale"
            :enabled-categories="enabledCategories"
            :day="rhythmDate"
            :is-today="isRhythmToday"
            @prev="onRhythmPrevDay"
            @next="onRhythmNextDay"
          />
          <WeeklySleep
            v-if="enabledCategories.includes('sleep')"
            :sleeps="babies.recentSleeps"
            :date-locale="dateLocale"
          />

          <section class="flex flex-col gap-2">
            <h2 class="flex items-center gap-2 font-display text-base font-bold">
              <span
                class="h-4 w-1.5 shrink-0 rounded-full"
                style="background: linear-gradient(180deg, var(--brand), var(--brand-teal))"
              ></span>
              {{ t('dashboard.timeline.title') }}
            </h2>
            <TransitionGroup tag="ul" name="entry-list" class="flex flex-col gap-2">
              <template v-for="item in groupedTimeline" :key="item.key">
                <li v-if="item.kind === 'separator'" class="my-1 flex items-center gap-3">
                  <span class="h-px flex-1 bg-border"></span>
                  <span
                    class="shrink-0 rounded-full bg-surface-sunken px-4 py-1.5 text-sm font-bold text-brand"
                  >
                    {{ item.label }}
                  </span>
                  <span class="h-px flex-1 bg-border"></span>
                </li>
                <EntryCard
                  v-else
                  :category="entryCategory(item.entry)"
                  :title="entryTitle(item.entry)"
                  :meta="new Date(item.entry.at).toLocaleString(dateLocale)"
                  @open="onOpenEntry(item.entry)"
                >
                  <template #actions>
                    <DeleteButton @click="onDeleteEntry(item.entry)" />
                  </template>
                </EntryCard>
              </template>
            </TransitionGroup>
            <p
              v-if="rhythmTimeline.length === 0"
              class="rounded-2xl border border-dashed border-border p-4 text-center text-sm text-text-muted"
            >
              {{ t('dashboard.timeline.empty') }}
            </p>
          </section>

          <section
            v-if="enabledCategories.includes('feed') && isRhythmToday"
            class="card flex items-start gap-3 p-4"
          >
            <span
              class="grid h-8 w-8 shrink-0 place-items-center rounded-lg"
              :class="[categoryText.feed, categoryBg.feed]"
            >
              <CategoryIcon category="feed" class="h-[1.05rem] w-[1.05rem]" />
            </span>
            <div>
              <h2 class="font-display text-sm font-bold">
                {{ t('dashboard.feedPrediction.title') }}
              </h2>
              <p class="text-sm text-text-muted">{{ feedPredictionLabel }}</p>
            </div>
          </section>

          <section
            v-if="enabledCategories.includes('sleep') && isRhythmToday"
            class="card flex items-start gap-3 p-4"
          >
            <span
              class="grid h-8 w-8 shrink-0 place-items-center rounded-lg"
              :class="[categoryText.sleep, categoryBg.sleep]"
            >
              <CategoryIcon category="sleep" class="h-[1.05rem] w-[1.05rem]" />
            </span>
            <div>
              <h2 class="font-display text-sm font-bold">
                {{ t('dashboard.sleepPrediction.title') }}
              </h2>
              <p class="text-sm text-text-muted">{{ sleepPredictionLabel }}</p>
            </div>
          </section>

          <section v-if="enabledCategories.includes('growth')" class="flex flex-col gap-2">
            <h2 class="flex items-center gap-2 font-display text-base font-bold">
              <span class="h-4 w-1.5 shrink-0 rounded-full bg-growth"></span>
              {{ t('dashboard.growth.title') }}
            </h2>
            <ul class="flex flex-col gap-2">
              <EntryCard
                v-for="measurement in babies.growthMeasurements"
                :key="measurement.id"
                category="growth"
                :title="growthTitle(measurement)"
                :meta="new Date(measurement.measured_at).toLocaleDateString(dateLocale)"
                @open="openGrowthEdit(measurement)"
              >
                <template #actions>
                  <DeleteButton @click="onDeleteGrowthMeasurement(measurement.id)" />
                </template>
              </EntryCard>
            </ul>
            <p
              v-if="babies.growthMeasurements.length === 0"
              class="rounded-2xl border border-dashed border-border p-4 text-center text-sm text-text-muted"
            >
              {{ t('dashboard.growth.empty') }}
            </p>
          </section>
        </template>
      </main>

      <ActionBar v-if="isBorn" :items="actionBarItems" @select="openSheet" />

      <BottomSheet :open="activeSheet === 'feed'" @update:open="closeSheet">
        <h3 class="mb-4 flex items-center gap-2 font-display text-base font-bold">
          <span
            class="grid h-7 w-7 place-items-center rounded-lg"
            :class="[categoryText.feed, categoryBg.feed]"
          >
            <CategoryIcon category="feed" class="h-4 w-4" />
          </span>
          {{ editingFeedId ? t('dashboard.feedForm.editTitle') : t('dashboard.quickLog.feed') }}
        </h3>
        <form class="flex flex-col gap-4" @submit.prevent="onSubmitFeed">
          <SegmentedControl v-model="feedType" :options="feedTypeOptions" />
          <SegmentedControl
            v-if="feedType === 'pecho'"
            v-model="feedSide"
            :options="feedSideOptions"
          />
          <div v-if="feedType === 'biberon'">
            <label for="feed-amount" class="field-label">{{
              t('dashboard.feedForm.amount')
            }}</label>
            <input
              id="feed-amount"
              v-model="feedAmountMl"
              type="number"
              min="1"
              required
              class="field-input"
            />
          </div>
          <div>
            <label for="feed-started-at" class="field-label">{{
              t('dashboard.feedForm.when')
            }}</label>
            <input
              id="feed-started-at"
              v-model="feedStartedAt"
              type="datetime-local"
              :min="minDateTime"
              required
              class="field-input"
            />
          </div>
          <div class="mt-1 flex gap-3">
            <button type="button" class="btn-ghost flex-1" @click="closeSheet">
              {{ t('common.cancel') }}
            </button>
            <button type="submit" :disabled="savingFeed" class="btn-primary flex-1">
              {{ t('common.save') }}
            </button>
          </div>
        </form>
      </BottomSheet>

      <BottomSheet :open="activeSheet === 'sleep'" @update:open="closeSheet">
        <h3 class="mb-4 flex items-center gap-2 font-display text-base font-bold">
          <span
            class="grid h-7 w-7 place-items-center rounded-lg"
            :class="[categoryText.sleep, categoryBg.sleep]"
          >
            <CategoryIcon category="sleep" class="h-4 w-4" />
          </span>
          {{ editingSleepId ? t('dashboard.sleepForm.editTitle') : t('dashboard.quickLog.sleep') }}
        </h3>
        <form class="flex flex-col gap-4" @submit.prevent="onSubmitSleep">
          <div>
            <label for="sleep-started-at" class="field-label">{{
              t('dashboard.sleepForm.start')
            }}</label>
            <input
              id="sleep-started-at"
              v-model="sleepStartedAt"
              type="datetime-local"
              :min="minDateTime"
              required
              class="field-input"
            />
          </div>
          <div>
            <label for="sleep-ended-at" class="field-label">{{
              t('dashboard.sleepForm.end')
            }}</label>
            <input
              id="sleep-ended-at"
              v-model="sleepEndedAt"
              type="datetime-local"
              :min="sleepStartedAt || minDateTime"
              class="field-input"
            />
          </div>
          <div class="mt-1 flex gap-3">
            <button type="button" class="btn-ghost flex-1" @click="closeSheet">
              {{ t('common.cancel') }}
            </button>
            <button type="submit" :disabled="savingSleep" class="btn-primary flex-1">
              {{ t('common.save') }}
            </button>
          </div>
        </form>
      </BottomSheet>

      <BottomSheet :open="activeSheet === 'diaper'" @update:open="closeSheet">
        <h3 class="mb-4 flex items-center gap-2 font-display text-base font-bold">
          <span
            class="grid h-7 w-7 place-items-center rounded-lg"
            :class="[categoryText.diaper, categoryBg.diaper]"
          >
            <CategoryIcon category="diaper" class="h-4 w-4" />
          </span>
          {{
            editingDiaperId ? t('dashboard.diaperForm.editTitle') : t('dashboard.quickLog.diaper')
          }}
        </h3>
        <form class="flex flex-col gap-4" @submit.prevent="onSubmitDiaper">
          <SegmentedControl v-model="diaperType" :options="diaperTypeOptions" />
          <div>
            <label for="diaper-changed-at" class="field-label">{{
              t('dashboard.diaperForm.when')
            }}</label>
            <input
              id="diaper-changed-at"
              v-model="diaperChangedAt"
              type="datetime-local"
              :min="minDateTime"
              required
              class="field-input"
            />
          </div>
          <div class="mt-1 flex gap-3">
            <button type="button" class="btn-ghost flex-1" @click="closeSheet">
              {{ t('common.cancel') }}
            </button>
            <button type="submit" :disabled="savingDiaper" class="btn-primary flex-1">
              {{ t('common.save') }}
            </button>
          </div>
        </form>
      </BottomSheet>

      <BottomSheet :open="activeSheet === 'growth'" @update:open="closeSheet">
        <h3 class="mb-4 flex items-center gap-2 font-display text-base font-bold">
          <span
            class="grid h-7 w-7 place-items-center rounded-lg"
            :class="[categoryText.growth, categoryBg.growth]"
          >
            <CategoryIcon category="growth" class="h-4 w-4" />
          </span>
          {{
            editingGrowthId ? t('dashboard.growthForm.editTitle') : t('dashboard.quickLog.growth')
          }}
        </h3>
        <form class="flex flex-col gap-4" @submit.prevent="onSubmitGrowth">
          <div>
            <label for="growth-measured-at" class="field-label">{{
              t('dashboard.growthForm.date')
            }}</label>
            <input
              id="growth-measured-at"
              v-model="growthMeasuredAt"
              type="date"
              :min="minDate"
              required
              class="field-input"
            />
          </div>
          <div>
            <label for="growth-weight" class="field-label">{{
              t('dashboard.growthForm.weight')
            }}</label>
            <input
              id="growth-weight"
              v-model="growthWeightKg"
              type="number"
              min="0.1"
              step="0.1"
              class="field-input"
            />
          </div>
          <div>
            <label for="growth-height" class="field-label">{{
              t('dashboard.growthForm.height')
            }}</label>
            <input
              id="growth-height"
              v-model="growthHeightCm"
              type="number"
              min="1"
              step="0.1"
              class="field-input"
            />
          </div>
          <div>
            <label for="growth-head" class="field-label">{{
              t('dashboard.growthForm.headCircumference')
            }}</label>
            <input
              id="growth-head"
              v-model="growthHeadCircumferenceCm"
              type="number"
              min="1"
              step="0.1"
              class="field-input"
            />
          </div>
          <p v-if="growthError" role="alert" class="text-sm font-medium text-danger">
            {{ growthError }}
          </p>
          <div class="mt-1 flex gap-3">
            <button type="button" class="btn-ghost flex-1" @click="closeSheet">
              {{ t('common.cancel') }}
            </button>
            <button type="submit" :disabled="savingGrowth" class="btn-primary flex-1">
              {{ t('common.save') }}
            </button>
          </div>
        </form>
      </BottomSheet>

      <BottomSheet :open="activeSheet === 'milestone'" @update:open="closeSheet">
        <h3 class="mb-4 flex items-center gap-2 font-display text-base font-bold">
          <span
            class="grid h-7 w-7 place-items-center rounded-lg"
            :class="[categoryText.milestone, categoryBg.milestone]"
          >
            <CategoryIcon category="milestone" class="h-4 w-4" />
          </span>
          {{
            editingMilestoneId
              ? t('dashboard.milestoneForm.editTitle')
              : t('dashboard.quickLog.milestone')
          }}
        </h3>
        <form class="flex flex-col gap-4" @submit.prevent="onSubmitMilestone">
          <div>
            <label for="milestone-achieved-at" class="field-label">{{
              t('dashboard.milestoneForm.date')
            }}</label>
            <input
              id="milestone-achieved-at"
              v-model="milestoneAchievedAt"
              type="date"
              :min="minDate"
              required
              class="field-input"
            />
          </div>
          <div>
            <span class="field-label">{{ t('dashboard.milestoneForm.category') }}</span>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="category in milestoneCategories"
                :key="category"
                type="button"
                class="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors"
                :class="
                  milestoneCategory === category
                    ? 'border-milestone bg-milestone/15 text-milestone'
                    : 'border-border text-text-muted'
                "
                @click="selectMilestoneCategory(category)"
              >
                <span>{{ milestoneCategoryEmoji[category] }}</span>
                <span>{{ t(`dashboard.milestoneForm.categories.${category}`) }}</span>
              </button>
            </div>
          </div>
          <div>
            <label for="milestone-title" class="field-label">{{
              t('dashboard.milestoneForm.title')
            }}</label>
            <input
              id="milestone-title"
              v-model="milestoneTitle"
              type="text"
              required
              class="field-input"
            />
          </div>
          <div>
            <label for="milestone-description" class="field-label">{{
              t('dashboard.milestoneForm.description')
            }}</label>
            <textarea
              id="milestone-description"
              v-model="milestoneDescription"
              rows="2"
              :placeholder="milestoneDescriptionPrompt"
              class="field-input"
            ></textarea>
          </div>
          <div>
            <label for="milestone-photo" class="field-label">{{
              t('dashboard.milestoneForm.photo')
            }}</label>
            <div
              v-if="milestoneExistingPhotoUrl && !milestoneRemovePhoto"
              class="mb-2 flex items-center gap-3"
            >
              <img
                :src="milestoneExistingPhotoUrl"
                alt=""
                class="h-14 w-14 rounded-lg object-cover"
              />
              <button
                type="button"
                class="text-sm font-semibold text-danger"
                @click="milestoneRemovePhoto = true"
              >
                {{ t('dashboard.milestoneForm.removePhoto') }}
              </button>
            </div>
            <input
              id="milestone-photo"
              type="file"
              accept="image/*"
              class="w-full text-sm text-text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-brand/15 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-brand"
              @change="onMilestonePhotoChange"
            />
          </div>
          <div class="mt-1 flex gap-3">
            <button type="button" class="btn-ghost flex-1" @click="closeSheet">
              {{ t('common.cancel') }}
            </button>
            <button type="submit" :disabled="savingMilestone" class="btn-primary flex-1">
              {{ t('common.save') }}
            </button>
          </div>
        </form>
      </BottomSheet>

      <MilestoneStoryViewer
        v-if="viewingMilestone"
        :milestone="viewingMilestone"
        :index="viewingMilestoneIndex"
        :total="babies.milestones.length"
        :is-first="viewingMilestoneIndex === 0"
        :is-last="viewingMilestoneIndex === babies.milestones.length - 1"
        :is-liked="isLikedByMe"
        :date-locale="dateLocale"
        @close="closeMilestoneDetail"
        @prev="goToPrevMilestone"
        @next="goToNextMilestone"
        @edit="openMilestoneEdit(viewingMilestone)"
        @delete="onDeleteViewingMilestone"
        @toggle-like="onToggleMilestoneLike"
      />

      <BottomSheet :open="activeSheet === 'settings'" @update:open="closeSheet">
        <h3 class="mb-4 font-display text-base font-bold">
          {{ t('dashboard.babySettingsButton') }}
        </h3>
        <form class="flex flex-col gap-4" @submit.prevent="onSaveBabySettings">
          <div>
            <span class="field-label">{{ t('dashboard.babySettings.sexLabel') }}</span>
            <SegmentedControl v-model="babySex" :options="babySexOptions" />
          </div>
          <div>
            <label for="baby-birth-date" class="field-label">{{
              t('dashboard.babySettings.birthDate')
            }}</label>
            <input id="baby-birth-date" v-model="babyBirthDate" type="date" class="field-input" />
          </div>
          <div class="mt-1 flex gap-3">
            <button type="button" class="btn-ghost flex-1" @click="closeSheet">
              {{ t('common.cancel') }}
            </button>
            <button type="submit" :disabled="savingBabySettings" class="btn-primary flex-1">
              {{ t('common.save') }}
            </button>
          </div>
        </form>

        <div class="mt-6 flex flex-col gap-3 border-t border-border pt-5">
          <button
            type="button"
            class="text-center text-sm font-semibold text-brand"
            @click="openSheet('addBaby')"
          >
            {{ t('dashboard.babySettings.addAnotherBaby') }}
          </button>

          <template v-if="!isBorn">
            <button
              v-if="!confirmingDeleteContractions"
              type="button"
              class="text-center text-sm font-semibold text-danger"
              @click="confirmingDeleteContractions = true"
            >
              {{ t('dashboard.babySettings.deleteAllContractions') }}
            </button>
            <template v-else>
              <p class="text-sm text-text-muted">
                {{ t('dashboard.babySettings.deleteAllContractionsConfirm') }}
              </p>
              <p
                v-if="deleteContractionsError"
                role="alert"
                class="text-sm font-medium text-danger"
              >
                {{ deleteContractionsError }}
              </p>
              <div class="flex gap-3">
                <button type="button" class="btn-ghost flex-1" @click="cancelDeleteAllContractions">
                  {{ t('common.cancel') }}
                </button>
                <button
                  type="button"
                  :disabled="deletingContractions"
                  class="btn-primary flex-1 !bg-danger !text-white"
                  @click="onDeleteAllContractions"
                >
                  {{
                    deletingContractions
                      ? t('dashboard.babySettings.deletingContractions')
                      : t('dashboard.babySettings.deleteAllContractionsConfirmYes')
                  }}
                </button>
              </div>
            </template>
          </template>

          <button
            v-if="!confirmingLeave"
            type="button"
            class="text-center text-sm font-semibold text-danger"
            @click="confirmingLeave = true"
          >
            {{ t('dashboard.babySettings.leaveBaby') }}
          </button>
          <template v-else>
            <p class="text-sm text-text-muted">{{ t('dashboard.babySettings.leaveConfirm') }}</p>
            <p v-if="leaveError" role="alert" class="text-sm font-medium text-danger">
              {{ leaveError }}
            </p>
            <div class="flex gap-3">
              <button type="button" class="btn-ghost flex-1" @click="cancelLeaveBaby">
                {{ t('common.cancel') }}
              </button>
              <button
                type="button"
                :disabled="leaving"
                class="btn-primary flex-1 !bg-danger !text-white"
                @click="onLeaveBaby"
              >
                {{
                  leaving
                    ? t('dashboard.babySettings.leaving')
                    : t('dashboard.babySettings.leaveConfirmYes')
                }}
              </button>
            </div>
          </template>
        </div>
      </BottomSheet>

      <BottomSheet :open="activeSheet === 'addBaby'" @update:open="closeSheet">
        <h3 class="mb-4 font-display text-base font-bold">
          {{ t('dashboard.babySettings.addAnotherBaby') }}
        </h3>

        <section class="flex flex-col gap-4">
          <h4 class="font-display text-sm font-bold">
            {{ t('dashboard.onboarding.createTitle') }}
          </h4>
          <form class="flex flex-col gap-4" @submit.prevent="onCreateBaby">
            <div>
              <label for="add-baby-name" class="field-label">{{
                t('dashboard.onboarding.name')
              }}</label>
              <input id="add-baby-name" v-model="babyName" type="text" class="field-input" />
            </div>
            <div>
              <label for="add-due-date" class="field-label">{{
                t('dashboard.onboarding.dueDate')
              }}</label>
              <input id="add-due-date" v-model="dueDate" type="date" class="field-input" />
            </div>
            <p v-if="createError" role="alert" class="text-sm font-medium text-danger">
              {{ createError }}
            </p>
            <button type="submit" :disabled="creatingBaby" class="btn-primary">
              {{ t('dashboard.onboarding.create') }}
            </button>
          </form>
        </section>

        <section class="mt-6 flex flex-col gap-4 border-t border-border pt-5">
          <h4 class="font-display text-sm font-bold">{{ t('dashboard.onboarding.joinTitle') }}</h4>
          <form class="flex flex-col gap-4" @submit.prevent="onJoinBaby">
            <div>
              <label for="add-invite-code" class="field-label">{{
                t('dashboard.onboarding.inviteCode')
              }}</label>
              <input
                id="add-invite-code"
                v-model="inviteCodeInput"
                type="text"
                required
                class="field-input uppercase tracking-widest"
              />
            </div>
            <p v-if="joinError" role="alert" class="text-sm font-medium text-danger">
              {{ joinError }}
            </p>
            <button type="submit" :disabled="joiningBaby" class="btn-primary">
              {{ t('dashboard.onboarding.join') }}
            </button>
          </form>
        </section>
      </BottomSheet>
    </template>
  </template>
</template>
