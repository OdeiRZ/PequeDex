<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useBabiesStore, type BabySex } from '@/stores/babies'
import { toDateOnlyString } from '@/lib/localDate'
import AppMark from './AppMark.vue'
import WheelColumn from './WheelColumn.vue'

// Replaces the old single-screen "everything at once" create-baby form -
// one question per step (name -> due date -> sex -> confirm), all still
// optional, with a "Saltar" escape hatch that jumps straight to
// confirmation from anywhere. Used both for the very first baby
// (DashboardView's full-screen onboarding) and for "Añadir otro bebé"
// (inside a BottomSheet) - stays self-contained (calls babies.create()
// itself) so both call sites just listen for `created`.
const props = defineProps<{ dateLocale: string }>()
const emit = defineEmits<{ created: [] }>()

const { t } = useI18n()
const babies = useBabiesStore()

const STEP_NAME = 0
const STEP_DATE = 1
const STEP_SEX = 2
const STEP_DONE = 3

const step = ref(STEP_NAME)

const name = ref('')

const today = new Date()
const hasDueDate = ref(true)
const wheelDay = ref(today.getDate())
const wheelMonth = ref(today.getMonth())
const wheelYear = ref(today.getFullYear())

const dayItems = Array.from({ length: 31 }, (_, i) => ({ value: i + 1, label: String(i + 1) }))
const monthItems = computed(() =>
  Array.from({ length: 12 }, (_, i) => ({
    value: i,
    label: new Date(2024, i, 1).toLocaleDateString(props.dateLocale, { month: 'short' }),
  })),
)
const yearItems = Array.from({ length: 3 }, (_, i) => {
  const year = today.getFullYear() + i
  return { value: year, label: String(year) }
})

function clearDueDate() {
  hasDueDate.value = false
  step.value = STEP_SEX
}

function confirmDate() {
  hasDueDate.value = true
  next()
}

const sex = ref<BabySex | ''>('')
const sexOptions: { value: BabySex | ''; icon: string; labelKey: string }[] = [
  { value: 'nino', icon: '💙', labelKey: 'dashboard.babySettings.sexBoy' },
  { value: 'nina', icon: '💗', labelKey: 'dashboard.babySettings.sexGirl' },
  { value: '', icon: '🤍', labelKey: 'dashboard.babySettings.sexUnknown' },
]

const creating = ref(false)
const error = ref<string | null>(null)

function next() {
  if (step.value < STEP_DONE) step.value += 1
}

function prev() {
  if (step.value > STEP_NAME) step.value -= 1
}

function skip() {
  step.value = STEP_DONE
}

async function submit() {
  error.value = null
  creating.value = true

  let due_date: string | undefined

  if (hasDueDate.value) {
    // A wheel picker can't dynamically resize its day column per month
    // without either resetting the user's scroll position or a lot of
    // extra bookkeeping - clamping an out-of-range day (31 in a 30-day
    // month) to that month's real last day keeps the picker itself
    // simple while still never sending an invalid date.
    const daysInMonth = new Date(wheelYear.value, wheelMonth.value + 1, 0).getDate()
    const clampedDay = Math.min(wheelDay.value, daysInMonth)
    due_date = toDateOnlyString(new Date(wheelYear.value, wheelMonth.value, clampedDay))
  }

  try {
    await babies.create({
      name: name.value.trim() || undefined,
      due_date,
      sex: sex.value || undefined,
    })
    emit('created')
  } catch {
    error.value = t('dashboard.onboarding.createError')
  } finally {
    creating.value = false
  }
}

const progressSteps = [STEP_NAME, STEP_DATE, STEP_SEX]
const showHeader = computed(() => step.value !== STEP_DONE)

// The "Añadir otro bebé" sheet (DashboardView.vue) keeps this component
// mounted across opens/closes like every other sheet's form fields - it
// calls this when the sheet opens instead of unmounting/remounting, so a
// second baby's wizard doesn't pick up where the first one's left off.
function reset() {
  step.value = STEP_NAME
  name.value = ''
  hasDueDate.value = true
  wheelDay.value = today.getDate()
  wheelMonth.value = today.getMonth()
  wheelYear.value = today.getFullYear()
  sex.value = ''
  error.value = null
}

defineExpose({ reset })
</script>

<template>
  <div class="flex flex-1 flex-col">
    <div v-if="showHeader" class="mb-6 flex items-center justify-between">
      <button
        type="button"
        class="grid h-8 w-8 place-items-center rounded-full bg-surface text-text shadow-sm"
        :class="{ invisible: step === STEP_NAME }"
        :disabled="step === STEP_NAME"
        :aria-label="t('common.back')"
        @click="prev"
      >
        ‹
      </button>
      <div class="flex gap-1.5">
        <span
          v-for="s in progressSteps"
          :key="s"
          class="h-1.5 rounded-full bg-border transition-all"
          :class="s === step ? 'w-5 bg-brand' : 'w-1.5'"
        />
      </div>
      <button type="button" class="text-xs font-semibold text-text-muted" @click="skip">
        {{ t('dashboard.onboarding.wizardSkip') }}
      </button>
    </div>

    <div v-if="step === STEP_NAME" key="step-name" class="wizard-step flex flex-1 flex-col">
      <h2 class="mb-1.5 font-display text-2xl font-bold text-balance">
        {{ t('dashboard.onboarding.wizardNameTitle') }}
      </h2>
      <p class="mb-6 text-sm text-text-muted">{{ t('dashboard.onboarding.wizardNameHint') }}</p>
      <input
        v-model="name"
        type="text"
        class="field-input"
        :placeholder="t('dashboard.onboarding.name')"
      />
      <div class="mt-auto pt-6">
        <button v-press type="button" class="btn-primary w-full" @click="next">
          {{ t('dashboard.onboarding.wizardNext') }}
        </button>
      </div>
    </div>

    <div v-else-if="step === STEP_DATE" key="step-date" class="wizard-step flex flex-1 flex-col">
      <h2 class="mb-1.5 font-display text-2xl font-bold text-balance">
        {{ t('dashboard.onboarding.wizardDateTitle') }}
      </h2>
      <p class="mb-6 text-sm text-text-muted">{{ t('dashboard.onboarding.wizardDateHint') }}</p>
      <div class="flex justify-center gap-2.5">
        <WheelColumn
          v-model="wheelDay"
          :items="dayItems"
          :ariaLabel="t('dashboard.onboarding.wizardDay')"
        />
        <WheelColumn
          v-model="wheelMonth"
          :items="monthItems"
          :ariaLabel="t('dashboard.onboarding.wizardMonth')"
        />
        <WheelColumn
          v-model="wheelYear"
          :items="yearItems"
          :ariaLabel="t('dashboard.onboarding.wizardYear')"
        />
      </div>
      <div class="mt-auto flex flex-col items-center gap-3 pt-6">
        <button type="button" class="text-sm font-semibold text-text-muted" @click="clearDueDate">
          {{ t('dashboard.onboarding.noDueDate') }}
        </button>
        <button v-press type="button" class="btn-primary w-full" @click="confirmDate">
          {{ t('dashboard.onboarding.wizardNext') }}
        </button>
      </div>
    </div>

    <div v-else-if="step === STEP_SEX" key="step-sex" class="wizard-step flex flex-1 flex-col">
      <h2 class="mb-1.5 font-display text-2xl font-bold text-balance">
        {{ t('dashboard.onboarding.wizardSexTitle') }}
      </h2>
      <p class="mb-6 text-sm text-text-muted">{{ t('dashboard.onboarding.wizardSexHint') }}</p>
      <div class="flex flex-col gap-2.5">
        <button
          v-for="option in sexOptions"
          :key="option.value"
          type="button"
          class="tap-card"
          :class="{ 'tap-card-selected': sex === option.value }"
          @click="sex = option.value"
        >
          <span aria-hidden="true">{{ option.icon }}</span>
          {{ t(option.labelKey) }}
          <span v-if="sex === option.value" class="ml-auto text-brand" aria-hidden="true">✓</span>
        </button>
      </div>
      <div class="mt-auto pt-6">
        <button v-press type="button" class="btn-primary w-full" @click="next">
          {{ t('dashboard.onboarding.wizardNext') }}
        </button>
      </div>
    </div>

    <div
      v-else
      key="step-done"
      class="wizard-step flex flex-1 flex-col items-center justify-center gap-2 text-center"
    >
      <AppMark full beat-heart :size="56" />
      <h2 class="mt-2 font-display text-2xl font-bold">
        {{ t('dashboard.onboarding.wizardDoneTitle') }}
      </h2>
      <p class="mb-6 text-sm text-text-muted">{{ t('dashboard.onboarding.wizardDoneHint') }}</p>
      <p v-if="error" role="alert" class="mb-2 text-sm font-medium text-danger">{{ error }}</p>
      <button v-press type="button" class="btn-primary w-full" :disabled="creating" @click="submit">
        {{ t('dashboard.onboarding.create') }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.wizard-step {
  animation: wizard-step-in 0.32s cubic-bezier(0.22, 1, 0.36, 1);
}

@keyframes wizard-step-in {
  from {
    opacity: 0;
    transform: translateX(18px);
  }
}

.tap-card {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  border-radius: 0.9rem;
  border: 2px solid var(--color-border);
  background: var(--color-surface);
  padding: 0.9rem 1rem;
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 0.95rem;
  color: var(--color-text);
  text-align: left;
  transition:
    border-color 0.15s ease,
    background 0.15s ease,
    transform 0.1s ease;
}

.tap-card span:first-child {
  font-size: 1.3rem;
}

.tap-card-selected {
  border-color: var(--color-brand);
  background: color-mix(in srgb, var(--color-brand) 10%, var(--color-surface));
  transform: scale(0.99);
}
</style>
