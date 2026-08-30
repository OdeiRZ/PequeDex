<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useBabiesStore, type BabySex, type DiaperType, type FeedType } from '@/stores/babies'

const router = useRouter()
const auth = useAuthStore()
const babies = useBabiesStore()

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
    createError.value = 'No se ha podido crear el bebé.'
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
    joinError.value = 'Código no válido.'
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

const timelineLabels: Record<string, string> = {
  feed: 'Toma',
  sleep: 'Sueño',
  diaper_change: 'Pañal',
}

function entrySummary(entry: (typeof babies.timeline)[number]): string {
  if (entry.type === 'feed') {
    return entry.data.type === 'biberon'
      ? `Biberón (${entry.data.amount_ml} ml)`
      : entry.data.type === 'pecho'
        ? `Pecho (${entry.data.side})`
        : 'Sólido'
  }

  if (entry.type === 'sleep') {
    return entry.data.ended_at ? 'Sueño (terminado)' : 'Sueño (en curso)'
  }

  return `Pañal (${entry.data.type})`
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
    growthError.value = 'Indica al menos peso, talla o perímetro craneal.'
  } finally {
    savingGrowth.value = false
  }
}

function formatPercentile(value: number | null): string {
  return value === null ? 'sin percentil' : `percentil ${value}`
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
    const sample = prediction?.sample_size ?? 0
    const minimum = prediction?.minimum_sample_size ?? 3
    return `Todavía no hay suficientes siestas registradas (${sample}/${minimum}) para estimar un patrón.`
  }

  if (!prediction.prediction) {
    return 'No hay suficiente regularidad en los horarios para estimar la siguiente siesta.'
  }

  const at = new Date(prediction.prediction.at).toLocaleString('es-ES')

  return prediction.prediction.type === 'wake_up'
    ? `Estimación de despertar: ${at}`
    : `Estimación de la siguiente siesta: ${at}`
})
</script>

<template>
  <div v-if="loading">Cargando...</div>

  <div v-else>
    <header>
      <h1>PequeDex</h1>
      <span v-if="auth.user">{{ auth.user.name }}</span>
      <button type="button" @click="onLogout">Cerrar sesión</button>
    </header>

    <section v-if="!babies.current">
      <h2>Crear un bebé</h2>
      <form @submit.prevent="onCreateBaby">
        <div>
          <label for="baby-name">Nombre (opcional)</label>
          <input id="baby-name" v-model="babyName" type="text" />
        </div>
        <div>
          <label for="due-date">Fecha prevista de parto (opcional)</label>
          <input id="due-date" v-model="dueDate" type="date" />
        </div>
        <p v-if="createError" role="alert">{{ createError }}</p>
        <button type="submit" :disabled="creatingBaby">Crear</button>
      </form>

      <h2>O unirme a un bebé existente</h2>
      <form @submit.prevent="onJoinBaby">
        <div>
          <label for="invite-code">Código de invitación</label>
          <input id="invite-code" v-model="inviteCodeInput" type="text" required />
        </div>
        <p v-if="joinError" role="alert">{{ joinError }}</p>
        <button type="submit" :disabled="joiningBaby">Unirme</button>
      </form>
    </section>

    <section v-else>
      <h2>{{ babies.current.name ?? 'Tu bebé' }}</h2>
      <p>
        Código de invitación para el otro cuidador: <strong>{{ inviteCode }}</strong>
      </p>
      <button type="button" @click="babies.regenerateInviteCode">Generar nuevo código</button>
      <button type="button" @click="openBabySettings">Sexo / fecha de nacimiento</button>

      <form v-if="showBabySettings" @submit.prevent="onSaveBabySettings">
        <div>
          <label for="baby-sex">Sexo (opcional, solo para el percentil de crecimiento)</label>
          <select id="baby-sex" v-model="babySex">
            <option value="">Prefiero no decirlo</option>
            <option value="nino">Niño</option>
            <option value="nina">Niña</option>
          </select>
        </div>
        <div>
          <label for="baby-birth-date">Fecha de nacimiento (opcional)</label>
          <input id="baby-birth-date" v-model="babyBirthDate" type="date" />
        </div>
        <button type="submit" :disabled="savingBabySettings">Guardar</button>
        <button type="button" @click="showBabySettings = false">Cancelar</button>
      </form>

      <div>
        <button type="button" @click="openForm('feed')">+ Toma</button>
        <button type="button" @click="openForm('sleep')">+ Sueño</button>
        <button type="button" @click="openForm('diaper')">+ Pañal</button>
        <button type="button" @click="openGrowthForm">+ Medida</button>
        <button type="button" @click="openMilestoneForm">+ Hito</button>
      </div>

      <form v-if="activeForm === 'feed'" @submit.prevent="onSubmitFeed">
        <div>
          <label for="feed-type">Tipo</label>
          <select id="feed-type" v-model="feedType">
            <option value="biberon">Biberón</option>
            <option value="pecho">Pecho</option>
            <option value="solido">Sólido</option>
          </select>
        </div>
        <div v-if="feedType === 'pecho'">
          <label for="feed-side">Lado</label>
          <select id="feed-side" v-model="feedSide">
            <option value="izquierdo">Izquierdo</option>
            <option value="derecho">Derecho</option>
            <option value="ambos">Ambos</option>
          </select>
        </div>
        <div v-if="feedType === 'biberon'">
          <label for="feed-amount">Cantidad (ml)</label>
          <input id="feed-amount" v-model="feedAmountMl" type="number" min="1" required />
        </div>
        <div>
          <label for="feed-started-at">Cuándo</label>
          <input id="feed-started-at" v-model="feedStartedAt" type="datetime-local" required />
        </div>
        <button type="submit" :disabled="savingFeed">Guardar</button>
        <button type="button" @click="activeForm = null">Cancelar</button>
      </form>

      <form v-if="activeForm === 'sleep'" @submit.prevent="onSubmitSleep">
        <div>
          <label for="sleep-started-at">Empieza</label>
          <input id="sleep-started-at" v-model="sleepStartedAt" type="datetime-local" required />
        </div>
        <div>
          <label for="sleep-ended-at">Termina (déjalo vacío si sigue durmiendo)</label>
          <input id="sleep-ended-at" v-model="sleepEndedAt" type="datetime-local" />
        </div>
        <button type="submit" :disabled="savingSleep">Guardar</button>
        <button type="button" @click="activeForm = null">Cancelar</button>
      </form>

      <form v-if="activeForm === 'diaper'" @submit.prevent="onSubmitDiaper">
        <div>
          <label for="diaper-type">Tipo</label>
          <select id="diaper-type" v-model="diaperType">
            <option value="mojado">Mojado</option>
            <option value="sucio">Sucio</option>
            <option value="ambos">Ambos</option>
          </select>
        </div>
        <div>
          <label for="diaper-changed-at">Cuándo</label>
          <input id="diaper-changed-at" v-model="diaperChangedAt" type="datetime-local" required />
        </div>
        <button type="submit" :disabled="savingDiaper">Guardar</button>
        <button type="button" @click="activeForm = null">Cancelar</button>
      </form>

      <form v-if="showGrowthForm" @submit.prevent="onSubmitGrowth">
        <div>
          <label for="growth-measured-at">Fecha</label>
          <input id="growth-measured-at" v-model="growthMeasuredAt" type="date" required />
        </div>
        <div>
          <label for="growth-weight">Peso (gramos)</label>
          <input id="growth-weight" v-model="growthWeightGrams" type="number" min="1" />
        </div>
        <div>
          <label for="growth-height">Talla (cm)</label>
          <input id="growth-height" v-model="growthHeightCm" type="number" min="1" step="0.1" />
        </div>
        <div>
          <label for="growth-head">Perímetro craneal (cm)</label>
          <input
            id="growth-head"
            v-model="growthHeadCircumferenceCm"
            type="number"
            min="1"
            step="0.1"
          />
        </div>
        <p v-if="growthError" role="alert">{{ growthError }}</p>
        <button type="submit" :disabled="savingGrowth">Guardar</button>
        <button type="button" @click="showGrowthForm = false">Cancelar</button>
      </form>

      <form v-if="showMilestoneForm" @submit.prevent="onSubmitMilestone">
        <div>
          <label for="milestone-achieved-at">Fecha</label>
          <input id="milestone-achieved-at" v-model="milestoneAchievedAt" type="date" required />
        </div>
        <div>
          <label for="milestone-title">Título</label>
          <input id="milestone-title" v-model="milestoneTitle" type="text" required />
        </div>
        <div>
          <label for="milestone-description">Descripción (opcional)</label>
          <textarea id="milestone-description" v-model="milestoneDescription"></textarea>
        </div>
        <div>
          <label for="milestone-photo">Foto (opcional)</label>
          <input
            id="milestone-photo"
            type="file"
            accept="image/*"
            @change="onMilestonePhotoChange"
          />
        </div>
        <button type="submit" :disabled="savingMilestone">Guardar</button>
        <button type="button" @click="showMilestoneForm = false">Cancelar</button>
      </form>

      <h3>Línea temporal</h3>
      <ul>
        <li v-for="entry in babies.timeline" :key="`${entry.type}-${entry.data.id}`">
          <strong>{{ timelineLabels[entry.type] }}</strong> — {{ entrySummary(entry) }} —
          {{ new Date(entry.at).toLocaleString('es-ES') }}
          <button type="button" @click="onDeleteEntry(entry)">Borrar</button>
        </li>
      </ul>
      <p v-if="babies.timeline.length === 0">Todavía no hay nada registrado.</p>

      <h3>Sueño: predicción</h3>
      <p>{{ sleepPredictionLabel }}</p>

      <h3>Crecimiento</h3>
      <ul>
        <li v-for="measurement in babies.growthMeasurements" :key="measurement.id">
          {{ new Date(measurement.measured_at).toLocaleDateString('es-ES') }} —
          <span v-if="measurement.weight_grams">
            {{ measurement.weight_grams }} g ({{ formatPercentile(measurement.weight_percentile) }})
          </span>
          <span v-if="measurement.height_cm">
            {{ measurement.height_cm }} cm ({{ formatPercentile(measurement.height_percentile) }})
          </span>
          <span v-if="measurement.head_circumference_cm">
            perímetro {{ measurement.head_circumference_cm }} cm ({{
              formatPercentile(measurement.head_circumference_percentile)
            }})
          </span>
          <button type="button" @click="babies.deleteGrowthMeasurement(measurement.id)">
            Borrar
          </button>
        </li>
      </ul>
      <p v-if="babies.growthMeasurements.length === 0">Todavía no hay medidas registradas.</p>

      <h3>Hitos</h3>
      <ul>
        <li v-for="milestone in babies.milestones" :key="milestone.id">
          <strong>{{ milestone.title }}</strong> —
          {{ new Date(milestone.achieved_at).toLocaleDateString('es-ES') }}
          <p v-if="milestone.description">{{ milestone.description }}</p>
          <img
            v-if="milestone.photo_url"
            :src="milestone.photo_url"
            :alt="milestone.title"
            width="120"
          />
          <button type="button" @click="babies.deleteMilestone(milestone.id)">Borrar</button>
        </li>
      </ul>
      <p v-if="babies.milestones.length === 0">Todavía no hay hitos registrados.</p>
    </section>
  </div>
</template>
