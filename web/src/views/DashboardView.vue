<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import { useBabiesStore, type BabySex, type DiaperType, type FeedType } from '@/stores/babies'

const router = useRouter()
const auth = useAuthStore()
const babies = useBabiesStore()
const { t, locale } = useI18n()

const dateLocale = computed(() => (locale.value === 'es' ? 'es-ES' : 'en-GB'))

const loading = ref(true)

onMounted(async () => {
  await babies.fetchCurrent()

  if (babies.current) {
    await Promise.all([
      babies.fetchTimeline(),
      babies.fetchGrowthMeasurements(),
      babies.fetchMilestones(),
      babies.fetchSleepPrediction(),
    ])
  }

  loading.value = false
})

async function onLogout() {
  await auth.logout()
  router.push({ name: 'login' })
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

// --- Registro rápido: toma / sueño / pañal ---

type QuickForm = 'feed' | 'sleep' | 'diaper' | null
const activeForm = ref<QuickForm>(null)

function nowForInput(): string {
  const now = new Date()
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset())
  return now.toISOString().slice(0, 16)
}

function openForm(form: QuickForm) {
  activeForm.value = form
  feedType.value = 'biberon'
  feedSide.value = 'izquierdo'
  feedAmountMl.value = ''
  feedStartedAt.value = nowForInput()
  sleepStartedAt.value = nowForInput()
  sleepEndedAt.value = ''
  diaperType.value = 'mojado'
  diaperChangedAt.value = nowForInput()
}

const feedType = ref<FeedType>('biberon')
const feedSide = ref<'izquierdo' | 'derecho' | 'ambos'>('izquierdo')
const feedAmountMl = ref('')
const feedStartedAt = ref('')
const savingFeed = ref(false)

async function onSubmitFeed() {
  savingFeed.value = true

  try {
    await babies.createFeed({
      type: feedType.value,
      side: feedType.value === 'pecho' ? feedSide.value : undefined,
      amount_ml: feedType.value === 'biberon' ? Number(feedAmountMl.value) : undefined,
      started_at: feedStartedAt.value,
    })
    activeForm.value = null
  } finally {
    savingFeed.value = false
  }
}

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
    activeForm.value = null
  } finally {
    savingSleep.value = false
  }
}

const diaperType = ref<DiaperType>('mojado')
const diaperChangedAt = ref('')
const savingDiaper = ref(false)

async function onSubmitDiaper() {
  savingDiaper.value = true

  try {
    await babies.createDiaperChange({
      changed_at: diaperChangedAt.value,
      type: diaperType.value,
    })
    activeForm.value = null
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

const timelineLabels = computed<Record<string, string>>(() => ({
  feed: t('dashboard.timeline.feed'),
  sleep: t('dashboard.timeline.sleep'),
  diaper_change: t('dashboard.timeline.diaperChange'),
}))

function entrySummary(entry: (typeof babies.timeline)[number]): string {
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
  if (entry.type === 'feed') {
    await babies.deleteFeed(entry.data.id)
  } else if (entry.type === 'sleep') {
    await babies.deleteSleep(entry.data.id)
  } else {
    await babies.deleteDiaperChange(entry.data.id)
  }
}

const inviteCode = computed(() => babies.current?.invite_code ?? '')

// --- Datos del bebé: sexo y fecha de nacimiento, necesarios para los
// percentiles de crecimiento OMS. Ambos opcionales - si faltan, el
// backend simplemente no calcula percentiles. ---

const showBabySettings = ref(false)
const babySex = ref<BabySex | ''>('')
const babyBirthDate = ref('')
const savingBabySettings = ref(false)

function openBabySettings() {
  babySex.value = babies.current?.sex ?? ''
  babyBirthDate.value = babies.current?.birth_date ?? ''
  showBabySettings.value = true
}

async function onSaveBabySettings() {
  savingBabySettings.value = true

  try {
    await babies.updateBaby({
      sex: babySex.value || null,
      birth_date: babyBirthDate.value || null,
    })
    showBabySettings.value = false
  } finally {
    savingBabySettings.value = false
  }
}

// --- Crecimiento: peso / talla / perímetro craneal, con percentil OMS
// calculado por el backend cuando el bebé tiene sexo y fecha de
// nacimiento. ---

const showGrowthForm = ref(false)
const growthMeasuredAt = ref('')
const growthWeightGrams = ref('')
const growthHeightCm = ref('')
const growthHeadCircumferenceCm = ref('')
const savingGrowth = ref(false)
const growthError = ref<string | null>(null)

function openGrowthForm() {
  growthMeasuredAt.value = new Date().toISOString().slice(0, 10)
  growthWeightGrams.value = ''
  growthHeightCm.value = ''
  growthHeadCircumferenceCm.value = ''
  growthError.value = null
  showGrowthForm.value = true
}

async function onSubmitGrowth() {
  savingGrowth.value = true
  growthError.value = null

  try {
    await babies.createGrowthMeasurement({
      measured_at: growthMeasuredAt.value,
      weight_grams: growthWeightGrams.value ? Number(growthWeightGrams.value) : undefined,
      height_cm: growthHeightCm.value ? Number(growthHeightCm.value) : undefined,
      head_circumference_cm: growthHeadCircumferenceCm.value
        ? Number(growthHeadCircumferenceCm.value)
        : undefined,
    })
    showGrowthForm.value = false
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

// --- Hitos con foto ---

const showMilestoneForm = ref(false)
const milestoneAchievedAt = ref('')
const milestoneTitle = ref('')
const milestoneDescription = ref('')
const milestonePhoto = ref<File | null>(null)
const savingMilestone = ref(false)

function openMilestoneForm() {
  milestoneAchievedAt.value = new Date().toISOString().slice(0, 10)
  milestoneTitle.value = ''
  milestoneDescription.value = ''
  milestonePhoto.value = null
  showMilestoneForm.value = true
}

function onMilestonePhotoChange(event: Event) {
  const input = event.target as HTMLInputElement
  milestonePhoto.value = input.files?.[0] ?? null
}

async function onSubmitMilestone() {
  savingMilestone.value = true

  try {
    await babies.createMilestone({
      achieved_at: milestoneAchievedAt.value,
      title: milestoneTitle.value,
      description: milestoneDescription.value || undefined,
      photo: milestonePhoto.value,
    })
    showMilestoneForm.value = false
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
  <div v-if="loading">{{ t('common.loading') }}</div>

  <div v-else>
    <header>
      <h1>{{ t('app.name') }}</h1>
      <span v-if="auth.user">{{ auth.user.name }}</span>
      <button type="button" @click="onLogout">{{ t('common.logout') }}</button>
    </header>

    <section v-if="!babies.current">
      <h2>{{ t('dashboard.onboarding.createTitle') }}</h2>
      <form @submit.prevent="onCreateBaby">
        <div>
          <label for="baby-name">{{ t('dashboard.onboarding.name') }}</label>
          <input id="baby-name" v-model="babyName" type="text" />
        </div>
        <div>
          <label for="due-date">{{ t('dashboard.onboarding.dueDate') }}</label>
          <input id="due-date" v-model="dueDate" type="date" />
        </div>
        <p v-if="createError" role="alert">{{ createError }}</p>
        <button type="submit" :disabled="creatingBaby">
          {{ t('dashboard.onboarding.create') }}
        </button>
      </form>

      <h2>{{ t('dashboard.onboarding.joinTitle') }}</h2>
      <form @submit.prevent="onJoinBaby">
        <div>
          <label for="invite-code">{{ t('dashboard.onboarding.inviteCode') }}</label>
          <input id="invite-code" v-model="inviteCodeInput" type="text" required />
        </div>
        <p v-if="joinError" role="alert">{{ joinError }}</p>
        <button type="submit" :disabled="joiningBaby">{{ t('dashboard.onboarding.join') }}</button>
      </form>
    </section>

    <section v-else>
      <h2>{{ babies.current.name ?? t('dashboard.defaultBabyName') }}</h2>
      <p>
        {{ t('dashboard.inviteCodeLabel') }} <strong>{{ inviteCode }}</strong>
      </p>
      <button type="button" @click="babies.regenerateInviteCode">
        {{ t('dashboard.regenerateInviteCode') }}
      </button>
      <button type="button" @click="openBabySettings">
        {{ t('dashboard.babySettingsButton') }}
      </button>

      <form v-if="showBabySettings" @submit.prevent="onSaveBabySettings">
        <div>
          <label for="baby-sex">{{ t('dashboard.babySettings.sexLabel') }}</label>
          <select id="baby-sex" v-model="babySex">
            <option value="">{{ t('dashboard.babySettings.sexUnknown') }}</option>
            <option value="nino">{{ t('dashboard.babySettings.sexBoy') }}</option>
            <option value="nina">{{ t('dashboard.babySettings.sexGirl') }}</option>
          </select>
        </div>
        <div>
          <label for="baby-birth-date">{{ t('dashboard.babySettings.birthDate') }}</label>
          <input id="baby-birth-date" v-model="babyBirthDate" type="date" />
        </div>
        <button type="submit" :disabled="savingBabySettings">{{ t('common.save') }}</button>
        <button type="button" @click="showBabySettings = false">{{ t('common.cancel') }}</button>
      </form>

      <div>
        <button type="button" @click="openForm('feed')">{{ t('dashboard.quickLog.feed') }}</button>
        <button type="button" @click="openForm('sleep')">
          {{ t('dashboard.quickLog.sleep') }}
        </button>
        <button type="button" @click="openForm('diaper')">
          {{ t('dashboard.quickLog.diaper') }}
        </button>
        <button type="button" @click="openGrowthForm">{{ t('dashboard.quickLog.growth') }}</button>
        <button type="button" @click="openMilestoneForm">
          {{ t('dashboard.quickLog.milestone') }}
        </button>
      </div>

      <form v-if="activeForm === 'feed'" @submit.prevent="onSubmitFeed">
        <div>
          <label for="feed-type">{{ t('dashboard.feedForm.type') }}</label>
          <select id="feed-type" v-model="feedType">
            <option value="biberon">{{ t('dashboard.feedForm.bottle') }}</option>
            <option value="pecho">{{ t('dashboard.feedForm.breast') }}</option>
            <option value="solido">{{ t('dashboard.feedForm.solid') }}</option>
          </select>
        </div>
        <div v-if="feedType === 'pecho'">
          <label for="feed-side">{{ t('dashboard.feedForm.side') }}</label>
          <select id="feed-side" v-model="feedSide">
            <option value="izquierdo">{{ t('dashboard.feedForm.left') }}</option>
            <option value="derecho">{{ t('dashboard.feedForm.right') }}</option>
            <option value="ambos">{{ t('dashboard.feedForm.both') }}</option>
          </select>
        </div>
        <div v-if="feedType === 'biberon'">
          <label for="feed-amount">{{ t('dashboard.feedForm.amount') }}</label>
          <input id="feed-amount" v-model="feedAmountMl" type="number" min="1" required />
        </div>
        <div>
          <label for="feed-started-at">{{ t('dashboard.feedForm.when') }}</label>
          <input id="feed-started-at" v-model="feedStartedAt" type="datetime-local" required />
        </div>
        <button type="submit" :disabled="savingFeed">{{ t('common.save') }}</button>
        <button type="button" @click="activeForm = null">{{ t('common.cancel') }}</button>
      </form>

      <form v-if="activeForm === 'sleep'" @submit.prevent="onSubmitSleep">
        <div>
          <label for="sleep-started-at">{{ t('dashboard.sleepForm.start') }}</label>
          <input id="sleep-started-at" v-model="sleepStartedAt" type="datetime-local" required />
        </div>
        <div>
          <label for="sleep-ended-at">{{ t('dashboard.sleepForm.end') }}</label>
          <input id="sleep-ended-at" v-model="sleepEndedAt" type="datetime-local" />
        </div>
        <button type="submit" :disabled="savingSleep">{{ t('common.save') }}</button>
        <button type="button" @click="activeForm = null">{{ t('common.cancel') }}</button>
      </form>

      <form v-if="activeForm === 'diaper'" @submit.prevent="onSubmitDiaper">
        <div>
          <label for="diaper-type">{{ t('dashboard.diaperForm.type') }}</label>
          <select id="diaper-type" v-model="diaperType">
            <option value="mojado">{{ t('dashboard.diaperForm.wet') }}</option>
            <option value="sucio">{{ t('dashboard.diaperForm.dirty') }}</option>
            <option value="ambos">{{ t('dashboard.diaperForm.both') }}</option>
          </select>
        </div>
        <div>
          <label for="diaper-changed-at">{{ t('dashboard.diaperForm.when') }}</label>
          <input id="diaper-changed-at" v-model="diaperChangedAt" type="datetime-local" required />
        </div>
        <button type="submit" :disabled="savingDiaper">{{ t('common.save') }}</button>
        <button type="button" @click="activeForm = null">{{ t('common.cancel') }}</button>
      </form>

      <form v-if="showGrowthForm" @submit.prevent="onSubmitGrowth">
        <div>
          <label for="growth-measured-at">{{ t('dashboard.growthForm.date') }}</label>
          <input id="growth-measured-at" v-model="growthMeasuredAt" type="date" required />
        </div>
        <div>
          <label for="growth-weight">{{ t('dashboard.growthForm.weight') }}</label>
          <input id="growth-weight" v-model="growthWeightGrams" type="number" min="1" />
        </div>
        <div>
          <label for="growth-height">{{ t('dashboard.growthForm.height') }}</label>
          <input id="growth-height" v-model="growthHeightCm" type="number" min="1" step="0.1" />
        </div>
        <div>
          <label for="growth-head">{{ t('dashboard.growthForm.headCircumference') }}</label>
          <input
            id="growth-head"
            v-model="growthHeadCircumferenceCm"
            type="number"
            min="1"
            step="0.1"
          />
        </div>
        <p v-if="growthError" role="alert">{{ growthError }}</p>
        <button type="submit" :disabled="savingGrowth">{{ t('common.save') }}</button>
        <button type="button" @click="showGrowthForm = false">{{ t('common.cancel') }}</button>
      </form>

      <form v-if="showMilestoneForm" @submit.prevent="onSubmitMilestone">
        <div>
          <label for="milestone-achieved-at">{{ t('dashboard.milestoneForm.date') }}</label>
          <input id="milestone-achieved-at" v-model="milestoneAchievedAt" type="date" required />
        </div>
        <div>
          <label for="milestone-title">{{ t('dashboard.milestoneForm.title') }}</label>
          <input id="milestone-title" v-model="milestoneTitle" type="text" required />
        </div>
        <div>
          <label for="milestone-description">{{ t('dashboard.milestoneForm.description') }}</label>
          <textarea id="milestone-description" v-model="milestoneDescription"></textarea>
        </div>
        <div>
          <label for="milestone-photo">{{ t('dashboard.milestoneForm.photo') }}</label>
          <input
            id="milestone-photo"
            type="file"
            accept="image/*"
            @change="onMilestonePhotoChange"
          />
        </div>
        <button type="submit" :disabled="savingMilestone">{{ t('common.save') }}</button>
        <button type="button" @click="showMilestoneForm = false">{{ t('common.cancel') }}</button>
      </form>

      <h3>{{ t('dashboard.timeline.title') }}</h3>
      <ul>
        <li v-for="entry in babies.timeline" :key="`${entry.type}-${entry.data.id}`">
          <strong>{{ timelineLabels[entry.type] }}</strong> — {{ entrySummary(entry) }} —
          {{ new Date(entry.at).toLocaleString(dateLocale) }}
          <button type="button" @click="onDeleteEntry(entry)">{{ t('common.delete') }}</button>
        </li>
      </ul>
      <p v-if="babies.timeline.length === 0">{{ t('dashboard.timeline.empty') }}</p>

      <h3>{{ t('dashboard.sleepPrediction.title') }}</h3>
      <p>{{ sleepPredictionLabel }}</p>

      <h3>{{ t('dashboard.growth.title') }}</h3>
      <ul>
        <li v-for="measurement in babies.growthMeasurements" :key="measurement.id">
          {{ new Date(measurement.measured_at).toLocaleDateString(dateLocale) }} —
          <span v-if="measurement.weight_grams">
            {{ measurement.weight_grams }} g ({{ formatPercentile(measurement.weight_percentile) }})
          </span>
          <span v-if="measurement.height_cm">
            {{ measurement.height_cm }} cm ({{ formatPercentile(measurement.height_percentile) }})
          </span>
          <span v-if="measurement.head_circumference_cm">
            {{ t('dashboard.growth.headCircumferenceShort') }}
            {{ measurement.head_circumference_cm }} cm ({{
              formatPercentile(measurement.head_circumference_percentile)
            }})
          </span>
          <button type="button" @click="babies.deleteGrowthMeasurement(measurement.id)">
            {{ t('common.delete') }}
          </button>
        </li>
      </ul>
      <p v-if="babies.growthMeasurements.length === 0">{{ t('dashboard.growth.empty') }}</p>

      <h3>{{ t('dashboard.milestones.title') }}</h3>
      <ul>
        <li v-for="milestone in babies.milestones" :key="milestone.id">
          <strong>{{ milestone.title }}</strong> —
          {{ new Date(milestone.achieved_at).toLocaleDateString(dateLocale) }}
          <p v-if="milestone.description">{{ milestone.description }}</p>
          <img
            v-if="milestone.photo_url"
            :src="milestone.photo_url"
            :alt="milestone.title"
            width="120"
          />
          <button type="button" @click="babies.deleteMilestone(milestone.id)">
            {{ t('common.delete') }}
          </button>
        </li>
      </ul>
      <p v-if="babies.milestones.length === 0">{{ t('dashboard.milestones.empty') }}</p>
    </section>
  </div>
</template>
