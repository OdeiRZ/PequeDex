<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import { useBabiesStore, type BabySex, type DiaperType, type FeedType } from '@/stores/babies'
import { useToastStore } from '@/stores/toast'
import ActionBar from '@/components/ActionBar.vue'
import BottomSheet from '@/components/BottomSheet.vue'
import CategoryIcon from '@/components/CategoryIcon.vue'
import DeleteButton from '@/components/DeleteButton.vue'
import EntryCard from '@/components/EntryCard.vue'
import MilestoneCard from '@/components/MilestoneCard.vue'
import PasswordField from '@/components/PasswordField.vue'
import SegmentedControl from '@/components/SegmentedControl.vue'
import UserAvatar from '@/components/UserAvatar.vue'
import { categoryBg, categoryText, type Category } from '@/lib/category'

const router = useRouter()
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

// Shared by the initial mount and by create/join below - without this,
// joining a baby that already has real history (the whole point of
// joining one instead of starting fresh) left the timeline/growth/
// milestones/prediction empty until a manual reload, since onMounted
// only ever runs once and babies.current turning non-null afterwards
// doesn't re-trigger it. Found live: looked like nothing had synced,
// when the join itself had actually worked.
async function loadBabyData() {
  loading.value = true

  try {
    await Promise.all([
      babies.fetchTimeline(),
      babies.fetchGrowthMeasurements(),
      babies.fetchMilestones(),
      babies.fetchSleepPrediction(),
    ])
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  await babies.fetchCurrent()

  if (babies.current) {
    await loadBabyData()
  } else {
    loading.value = false
  }
})

async function onLogout() {
  await auth.logout()
  router.push({ name: 'login' })
}

// --- Menú de usuario: datos personales, contraseña y foto de perfil.
// Sin errores por campo (a diferencia de LudoDex/MIRA MarketLens) - igual
// que el resto de formularios de esta app, un mensaje genérico por toast
// basta para lo que de verdad puede fallar aquí (email duplicado,
// contraseña actual incorrecta). ---

const profileName = ref('')
const profileEmail = ref('')
const savingProfile = ref(false)

const currentPassword = ref('')
const newPassword = ref('')
const newPasswordConfirmation = ref('')
const savingPassword = ref(false)

const avatarInput = ref<HTMLInputElement | null>(null)
const uploadingAvatar = ref(false)

async function onSubmitProfile() {
  savingProfile.value = true

  try {
    await auth.updateProfile({ name: profileName.value, email: profileEmail.value })
    toast.show(t('profile.toastSaved'))
  } catch {
    toast.show(t('profile.saveError'))
  } finally {
    savingProfile.value = false
  }
}

async function onSubmitPassword() {
  savingPassword.value = true

  try {
    await auth.updatePassword({
      current_password: currentPassword.value,
      password: newPassword.value,
      password_confirmation: newPasswordConfirmation.value,
    })
    currentPassword.value = ''
    newPassword.value = ''
    newPasswordConfirmation.value = ''
    toast.show(t('profile.toastPasswordSaved'))
  } catch {
    toast.show(t('profile.passwordError'))
  } finally {
    savingPassword.value = false
  }
}

function onPickAvatar() {
  avatarInput.value?.click()
}

async function onAvatarSelected(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return

  uploadingAvatar.value = true

  try {
    await auth.uploadAvatar(file)
    toast.show(t('profile.toastAvatarSaved'))
  } catch {
    toast.show(t('profile.avatarError'))
  } finally {
    uploadingAvatar.value = false
    ;(event.target as HTMLInputElement).value = ''
  }
}

async function onRemoveAvatar() {
  uploadingAvatar.value = true

  try {
    await auth.removeAvatar()
    toast.show(t('profile.toastAvatarRemoved'))
  } catch {
    toast.show(t('profile.avatarError'))
  } finally {
    uploadingAvatar.value = false
  }
}

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
    await loadBabyData()
  } catch {
    joinError.value = t('dashboard.onboarding.joinError')
  } finally {
    joiningBaby.value = false
  }
}

// --- Sincronización entre cuidadores: sondeo periódico de la línea
// temporal, mismo patrón que el import de BGG en LudoDex - sin
// websockets ni infraestructura nueva. ---
let pollTimer: ReturnType<typeof setInterval> | undefined

onMounted(() => {
  pollTimer = setInterval(() => {
    if (babies.current) {
      babies.fetchTimeline()
    }
  }, 5000)
})

onUnmounted(() => {
  clearInterval(pollTimer)
})

// --- Hojas inferiores: una por cada botón de la barra de acciones, más
// el ajuste de sexo/fecha de nacimiento del bebé. ---

type Sheet = Category | 'settings' | 'profile' | null
const activeSheet = ref<Sheet>(null)

function nowForInput(): string {
  const now = new Date()
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset())
  return now.toISOString().slice(0, 16)
}

function openSheet(sheet: Exclude<Sheet, null>) {
  if (sheet === 'feed') {
    feedType.value = 'biberon'
    feedSide.value = 'izquierdo'
    feedAmountMl.value = ''
    feedStartedAt.value = nowForInput()
  } else if (sheet === 'sleep') {
    sleepStartedAt.value = nowForInput()
    sleepEndedAt.value = ''
  } else if (sheet === 'diaper') {
    diaperType.value = 'mojado'
    diaperChangedAt.value = nowForInput()
  } else if (sheet === 'growth') {
    growthMeasuredAt.value = new Date().toISOString().slice(0, 10)
    growthWeightKg.value = ''
    growthHeightCm.value = ''
    growthHeadCircumferenceCm.value = ''
    growthError.value = null
  } else if (sheet === 'milestone') {
    milestoneAchievedAt.value = new Date().toISOString().slice(0, 10)
    milestoneTitle.value = ''
    milestoneDescription.value = ''
    milestonePhoto.value = null
    editingMilestoneId.value = null
    milestoneExistingPhotoUrl.value = null
    milestoneRemovePhoto.value = false
  } else if (sheet === 'settings') {
    babySex.value = babies.current?.sex ?? ''
    babyBirthDate.value = babies.current?.birth_date ?? ''
  } else if (sheet === 'profile') {
    profileName.value = auth.user?.name ?? ''
    profileEmail.value = auth.user?.email ?? ''
    currentPassword.value = ''
    newPassword.value = ''
    newPasswordConfirmation.value = ''
  }

  activeSheet.value = sheet
}

function closeSheet() {
  activeSheet.value = null
}

const actionBarItems = computed(() => [
  { category: 'feed' as const, label: t('dashboard.quickLog.feed') },
  { category: 'sleep' as const, label: t('dashboard.quickLog.sleep') },
  { category: 'diaper' as const, label: t('dashboard.quickLog.diaper') },
  { category: 'growth' as const, label: t('dashboard.quickLog.growth') },
  { category: 'milestone' as const, label: t('dashboard.quickLog.milestone') },
])

// --- Registro rápido: toma ---

const feedType = ref<FeedType>('biberon')
const feedSide = ref<'izquierdo' | 'derecho' | 'ambos'>('izquierdo')
const feedAmountMl = ref('')
const feedStartedAt = ref('')
const savingFeed = ref(false)

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

async function onSubmitFeed() {
  savingFeed.value = true

  try {
    await babies.createFeed({
      type: feedType.value,
      side: feedType.value === 'pecho' ? feedSide.value : undefined,
      amount_ml: feedType.value === 'biberon' ? Number(feedAmountMl.value) : undefined,
      started_at: feedStartedAt.value,
    })
    closeSheet()
  } catch {
    toast.show(t('dashboard.saveError'))
  } finally {
    savingFeed.value = false
  }
}

// --- Registro rápido: sueño ---

const sleepStartedAt = ref('')
const sleepEndedAt = ref('')
const savingSleep = ref(false)

async function onSubmitSleep() {
  savingSleep.value = true

  try {
    await babies.createSleep({
      started_at: sleepStartedAt.value,
      ended_at: sleepEndedAt.value || null,
    })
    closeSheet()
  } catch {
    toast.show(t('dashboard.saveError'))
  } finally {
    savingSleep.value = false
  }
}

// --- Registro rápido: pañal ---

const diaperType = ref<DiaperType>('mojado')
const diaperChangedAt = ref('')
const savingDiaper = ref(false)

const diaperTypeOptions = computed(() => [
  { value: 'mojado' as const, label: t('dashboard.diaperForm.wet') },
  { value: 'sucio' as const, label: t('dashboard.diaperForm.dirty') },
  { value: 'ambos' as const, label: t('dashboard.diaperForm.both') },
])

async function onSubmitDiaper() {
  savingDiaper.value = true

  try {
    await babies.createDiaperChange({
      changed_at: diaperChangedAt.value,
      type: diaperType.value,
    })
    closeSheet()
  } catch {
    toast.show(t('dashboard.saveError'))
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
    } else if (entry.type === 'sleep') {
      await babies.deleteSleep(entry.data.id)
    } else {
      await babies.deleteDiaperChange(entry.data.id)
    }
    toast.show(t(`dashboard.toastRemoved.${key}`))
  } catch {
    toast.show(t(`dashboard.removeError.${key}`))
  }
}

async function onDeleteGrowthMeasurement(id: number) {
  try {
    await babies.deleteGrowthMeasurement(id)
    toast.show(t('dashboard.toastRemoved.growth'))
  } catch {
    toast.show(t('dashboard.removeError.growth'))
  }
}

async function onDeleteMilestone(id: number) {
  try {
    await babies.deleteMilestone(id)
    toast.show(t('dashboard.toastRemoved.milestone'))
  } catch {
    toast.show(t('dashboard.removeError.milestone'))
  }
}

// --- Detalle de un hito: la miniatura de la lista no dejaba ver la foto
// entera ni la descripción completa - abre en una hoja de detalle propia,
// no en la de "+ Hito" (esa es solo el formulario de creación). ---

const viewingMilestone = ref<(typeof babies.milestones)[number] | null>(null)

function closeMilestoneDetail() {
  viewingMilestone.value = null
}

async function onDeleteViewingMilestone() {
  if (!viewingMilestone.value) return

  const id = viewingMilestone.value.id
  closeMilestoneDetail()
  await onDeleteMilestone(id)
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

const babySexOptions = computed(() => [
  { value: '' as const, label: t('dashboard.babySettings.sexUnknown') },
  { value: 'nino' as const, label: t('dashboard.babySettings.sexBoy') },
  { value: 'nina' as const, label: t('dashboard.babySettings.sexGirl') },
])

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

async function onRegenerateInviteCode() {
  try {
    await babies.regenerateInviteCode()
    toast.show(t('dashboard.toastInviteRegenerated'))
  } catch {
    toast.show(t('dashboard.inviteCodeError'))
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

async function onSubmitGrowth() {
  savingGrowth.value = true
  growthError.value = null

  try {
    await babies.createGrowthMeasurement({
      measured_at: growthMeasuredAt.value,
      weight_grams: growthWeightKg.value
        ? Math.round(Number(growthWeightKg.value) * 1000)
        : undefined,
      height_cm: growthHeightCm.value ? Number(growthHeightCm.value) : undefined,
      head_circumference_cm: growthHeadCircumferenceCm.value
        ? Number(growthHeadCircumferenceCm.value)
        : undefined,
    })
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
  milestoneTitle.value = milestone.title
  milestoneDescription.value = milestone.description ?? ''
  milestonePhoto.value = null
  milestoneExistingPhotoUrl.value = milestone.photo_url
  milestoneRemovePhoto.value = false
  closeMilestoneDetail()
  activeSheet.value = 'milestone'
}

async function onSubmitMilestone() {
  savingMilestone.value = true

  try {
    if (editingMilestoneId.value) {
      await babies.updateMilestone(editingMilestoneId.value, {
        achieved_at: milestoneAchievedAt.value,
        title: milestoneTitle.value,
        description: milestoneDescription.value || undefined,
        photo: milestonePhoto.value,
        removePhoto: milestoneRemovePhoto.value,
      })
      toast.show(t('dashboard.milestoneForm.toastUpdated'))
    } else {
      await babies.createMilestone({
        achieved_at: milestoneAchievedAt.value,
        title: milestoneTitle.value,
        description: milestoneDescription.value || undefined,
        photo: milestonePhoto.value,
      })
    }
    closeSheet()
  } catch {
    toast.show(t('dashboard.saveError'))
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
</script>

<template>
  <div v-if="loading" class="flex flex-1 items-center justify-center text-text-muted">
    {{ t('common.loading') }}
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
      <main class="flex flex-1 flex-col gap-6 px-4 py-5 pb-8">
        <div class="flex items-center justify-between text-sm text-text-muted">
          <button
            v-if="auth.user"
            type="button"
            class="flex items-center gap-2 font-semibold text-text"
            @click="openSheet('profile')"
          >
            <UserAvatar :name="auth.user.name" :avatar="auth.user.avatar" :size="28" />
            {{ auth.user.name }}
          </button>
          <button type="button" class="font-semibold text-brand" @click="onLogout">
            {{ t('common.logout') }}
          </button>
        </div>

        <div
          class="rounded-2xl p-5 text-brand-ink shadow-md"
          style="background: linear-gradient(155deg, var(--brand) 0%, var(--brand-teal) 130%)"
        >
          <div class="flex items-start justify-between gap-2">
            <button
              type="button"
              class="flex min-w-0 flex-1 items-start gap-1.5 text-left"
              :aria-expanded="inviteCodeExpanded"
              @click="inviteCodeExpanded = !inviteCodeExpanded"
            >
              <h1 class="font-display text-xl font-bold text-balance">
                {{ babies.current.name ?? t('dashboard.defaultBabyName') }}
              </h1>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                class="mt-1.5 h-4 w-4 shrink-0 transition-transform"
                :class="{ 'rotate-180': inviteCodeExpanded }"
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>
            <button
              type="button"
              class="shrink-0 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold"
              @click="openSheet('settings')"
            >
              {{ babySettingsButtonLabel }}
            </button>
          </div>
          <div
            v-if="inviteCodeExpanded"
            class="mt-3 flex items-center justify-between gap-2 rounded-xl bg-white/15 px-3 py-2 text-sm"
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

        <section class="flex flex-col gap-2">
          <h2 class="font-display text-base font-bold">{{ t('dashboard.timeline.title') }}</h2>
          <ul class="flex flex-col gap-2">
            <EntryCard
              v-for="entry in babies.timeline"
              :key="`${entry.type}-${entry.data.id}`"
              :category="entryCategory(entry)"
              :title="entryTitle(entry)"
              :meta="new Date(entry.at).toLocaleString(dateLocale)"
            >
              <template #actions>
                <DeleteButton @click="onDeleteEntry(entry)" />
              </template>
            </EntryCard>
          </ul>
          <p
            v-if="babies.timeline.length === 0"
            class="rounded-2xl border border-dashed border-border p-4 text-center text-sm text-text-muted"
          >
            {{ t('dashboard.timeline.empty') }}
          </p>
        </section>

        <section class="card flex items-start gap-3 p-4">
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

        <section class="flex flex-col gap-2">
          <h2 class="font-display text-base font-bold">{{ t('dashboard.growth.title') }}</h2>
          <ul class="flex flex-col gap-2">
            <EntryCard
              v-for="measurement in babies.growthMeasurements"
              :key="measurement.id"
              category="growth"
              :title="growthTitle(measurement)"
              :meta="new Date(measurement.measured_at).toLocaleDateString(dateLocale)"
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

        <section class="flex flex-col gap-2">
          <h2 class="font-display text-base font-bold">{{ t('dashboard.milestones.title') }}</h2>
          <ul class="grid grid-cols-2 gap-2">
            <MilestoneCard
              v-for="milestone in babies.milestones"
              :key="milestone.id"
              :title="milestone.title"
              :meta="new Date(milestone.achieved_at).toLocaleDateString(dateLocale)"
              :description="milestone.description"
              :photo-src="milestone.photo_url"
              :photo-alt="milestone.title"
              @open="viewingMilestone = milestone"
              @delete="onDeleteMilestone(milestone.id)"
            />
          </ul>
          <p
            v-if="babies.milestones.length === 0"
            class="rounded-2xl border border-dashed border-border p-4 text-center text-sm text-text-muted"
          >
            {{ t('dashboard.milestones.empty') }}
          </p>
        </section>
      </main>

      <ActionBar :items="actionBarItems" @select="openSheet" />

      <BottomSheet :open="activeSheet === 'feed'" @update:open="closeSheet">
        <h3 class="mb-4 flex items-center gap-2 font-display text-base font-bold">
          <span
            class="grid h-7 w-7 place-items-center rounded-lg"
            :class="[categoryText.feed, categoryBg.feed]"
          >
            <CategoryIcon category="feed" class="h-4 w-4" />
          </span>
          {{ t('dashboard.quickLog.feed') }}
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
          {{ t('dashboard.quickLog.sleep') }}
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
          {{ t('dashboard.quickLog.diaper') }}
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
          {{ t('dashboard.quickLog.growth') }}
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

      <BottomSheet :open="viewingMilestone !== null" @update:open="closeMilestoneDetail">
        <template v-if="viewingMilestone">
          <img
            v-if="viewingMilestone.photo_url"
            :src="viewingMilestone.photo_url"
            :alt="viewingMilestone.title"
            class="mb-4 max-h-[45vh] w-full rounded-xl object-cover"
          />
          <h3 class="font-display text-lg font-bold text-balance">{{ viewingMilestone.title }}</h3>
          <p class="text-sm tabular-nums text-text-muted">
            {{ new Date(viewingMilestone.achieved_at).toLocaleDateString(dateLocale) }}
          </p>
          <p v-if="viewingMilestone.description" class="mt-3 text-sm whitespace-pre-line">
            {{ viewingMilestone.description }}
          </p>
          <div class="mt-5 flex flex-col gap-3">
            <button type="button" class="btn-primary" @click="openMilestoneEdit(viewingMilestone)">
              {{ t('common.edit') }}
            </button>
            <div class="flex gap-3">
              <button type="button" class="btn-ghost flex-1" @click="onDeleteViewingMilestone">
                {{ t('common.delete') }}
              </button>
              <button type="button" class="btn-ghost flex-1" @click="closeMilestoneDetail">
                {{ t('common.close') }}
              </button>
            </div>
          </div>
        </template>
      </BottomSheet>

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
      </BottomSheet>

      <BottomSheet :open="activeSheet === 'profile'" @update:open="closeSheet">
        <div class="mb-4 flex items-center justify-between">
          <h3 class="font-display text-base font-bold">{{ t('profile.title') }}</h3>
          <button type="button" class="text-sm font-semibold text-brand" @click="closeSheet">
            {{ t('common.close') }}
          </button>
        </div>

        <div class="mb-5 flex items-center gap-4">
          <UserAvatar :name="auth.user?.name ?? ''" :avatar="auth.user?.avatar" :size="64" />
          <div class="flex flex-1 flex-col items-start gap-2">
            <input
              ref="avatarInput"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              class="hidden"
              @change="onAvatarSelected"
            />
            <button
              type="button"
              :disabled="uploadingAvatar"
              class="btn-ghost px-3 py-1.5 text-sm"
              @click="onPickAvatar"
            >
              {{ t('profile.uploadAvatar') }}
            </button>
            <button
              v-if="auth.user?.avatar"
              type="button"
              :disabled="uploadingAvatar"
              class="text-sm font-semibold text-danger"
              @click="onRemoveAvatar"
            >
              {{ t('profile.removeAvatar') }}
            </button>
          </div>
        </div>

        <form class="mb-6 flex flex-col gap-4" @submit.prevent="onSubmitProfile">
          <div>
            <label for="profile-name" class="field-label">{{ t('profile.name') }}</label>
            <input
              id="profile-name"
              v-model="profileName"
              type="text"
              required
              autocomplete="name"
              class="field-input"
            />
          </div>
          <div>
            <label for="profile-email" class="field-label">{{ t('profile.email') }}</label>
            <input
              id="profile-email"
              v-model="profileEmail"
              type="email"
              required
              autocomplete="email"
              class="field-input"
            />
          </div>
          <button type="submit" :disabled="savingProfile" class="btn-primary">
            {{ t('common.save') }}
          </button>
        </form>

        <form
          class="flex flex-col gap-4 border-t border-border pt-5"
          @submit.prevent="onSubmitPassword"
        >
          <h4 class="-mt-1 font-display text-sm font-bold">{{ t('profile.changePassword') }}</h4>
          <div>
            <label for="current-password" class="field-label">{{
              t('profile.currentPassword')
            }}</label>
            <PasswordField
              id="current-password"
              v-model="currentPassword"
              required
              autocomplete="current-password"
            />
          </div>
          <div>
            <label for="new-password" class="field-label">{{ t('profile.newPassword') }}</label>
            <PasswordField
              id="new-password"
              v-model="newPassword"
              required
              autocomplete="new-password"
            />
          </div>
          <div>
            <label for="new-password-confirmation" class="field-label">{{
              t('profile.newPasswordConfirmation')
            }}</label>
            <PasswordField
              id="new-password-confirmation"
              v-model="newPasswordConfirmation"
              required
              autocomplete="new-password"
            />
          </div>
          <button type="submit" :disabled="savingPassword" class="btn-primary">
            {{ t('profile.changePassword') }}
          </button>
        </form>
      </BottomSheet>
    </template>
  </template>
</template>
