<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useBabiesStore, type Checkup, type Vaccination } from '@/stores/babies'
import { useToastStore } from '@/stores/toast'
import { useFeedback } from '@/composables/useFeedback'
import AppMark from '@/components/AppMark.vue'
import BottomSheet from '@/components/BottomSheet.vue'
import { extractValidationMessage } from '@/lib/api'
import { parseDateOnly, todayDateOnlyString } from '@/lib/localDate'
import { toLocalInputValue, toUtcIso } from '@/lib/datetimeInput'
import { groupVaccinations, vaccinationStatus, type VaccinationStatus } from '@/lib/vaccinations'

// Cartilla digital: qué se ha puesto y cuándo, más las revisiones. La
// lista de vacunas sale de la plantilla de la comunidad del bebé (ver
// App\Services\Vaccinations en el backend) y es toda editable; las
// revisiones se añaden a mano - cada comunidad tiene su programa y la
// fecha real la da el centro de salud.

const babies = useBabiesStore()
const toast = useToastStore()
const feedback = useFeedback()
const { t, locale } = useI18n()

const dateLocale = computed(() => (locale.value === 'es' ? 'es-ES' : 'en-GB'))
const loading = ref(true)

onMounted(async () => {
  try {
    if (!babies.current) await babies.fetchCurrent()
    await babies.fetchVaccinations()
  } finally {
    loading.value = false
  }
})

const groups = computed(() => groupVaccinations(babies.vaccinations, t('vaccinations.customGroup')))

const givenCount = computed(() => babies.vaccinations.filter((v) => v.given_at).length)
const requiredCount = computed(
  () => babies.vaccinations.filter((v) => !v.optional || v.given_at).length,
)

function formatDate(date: string): string {
  return parseDateOnly(date).toLocaleDateString(dateLocale.value, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function formatDateTime(at: string): string {
  return new Date(at).toLocaleString(dateLocale.value, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const STATUS_CLASSES: Record<VaccinationStatus, string> = {
  given: 'bg-growth/15 text-growth',
  optional: 'bg-surface-sunken text-text-muted',
  overdue: 'bg-danger/15 text-danger',
  upcoming: 'bg-warning/15 text-warning',
  pending: 'bg-surface-sunken text-text-muted',
}

function statusLabel(vaccination: Vaccination): string {
  const status = vaccinationStatus(vaccination)
  if (status === 'given')
    return t('vaccinations.status.given', { date: formatDate(vaccination.given_at as string) })
  if (status === 'optional') return t('vaccinations.status.optional')
  if (!vaccination.due_date) return t('vaccinations.status.noDate')
  const key = status === 'overdue' ? 'overdue' : 'due'
  return t(`vaccinations.status.${key}`, { date: formatDate(vaccination.due_date) })
}

// --- Hoja de vacuna: marcar como puesta, editar, añadir propia ---

const vaccinationSheetOpen = ref(false)
const editingVaccination = ref<Vaccination | null>(null)
const vName = ref('')
const vDueDate = ref('')
const vGiven = ref(false)
const vGivenAt = ref('')
const vNotes = ref('')
const savingVaccination = ref(false)

function openVaccination(vaccination: Vaccination | null) {
  feedback.tap()
  editingVaccination.value = vaccination
  vName.value = vaccination?.name ?? ''
  vDueDate.value = vaccination?.due_date ?? ''
  vGiven.value = !!vaccination?.given_at || vaccination === null
  // Al marcarla como puesta, hoy por defecto - lo habitual es apuntarla
  // el mismo día.
  vGivenAt.value = vaccination?.given_at ?? todayDateOnlyString()
  vNotes.value = vaccination?.notes ?? ''
  vaccinationSheetOpen.value = true
}

async function onSaveVaccination() {
  savingVaccination.value = true
  try {
    await babies.saveVaccination(editingVaccination.value?.id ?? null, {
      name: vName.value.trim(),
      due_date: vDueDate.value || null,
      given_at: vGiven.value ? vGivenAt.value || null : null,
      notes: vNotes.value.trim() || null,
    })
    feedback.success()
    toast.show(t('vaccinations.toastSaved'))
    vaccinationSheetOpen.value = false
  } catch (error) {
    toast.show(extractValidationMessage(error) ?? t('vaccinations.saveError'), 'error')
  } finally {
    savingVaccination.value = false
  }
}

async function onDeleteVaccination() {
  if (!editingVaccination.value) return
  const id = editingVaccination.value.id
  vaccinationSheetOpen.value = false
  try {
    await babies.deleteVaccination(id)
    toast.show(t('vaccinations.toastDeleted'))
  } catch {
    toast.show(t('vaccinations.deleteError'), 'error')
  }
}

// --- Revisiones ---

const upcomingCheckups = computed(() =>
  babies.checkups.filter((c) => new Date(c.scheduled_at).getTime() >= Date.now()),
)
const pastCheckups = computed(() =>
  babies.checkups.filter((c) => new Date(c.scheduled_at).getTime() < Date.now()).reverse(),
)

const checkupSheetOpen = ref(false)
const editingCheckup = ref<Checkup | null>(null)
const cDate = ref('')
const cTime = ref('')
const cReason = ref('')
const cNotes = ref('')
const savingCheckup = ref(false)

function openCheckup(checkup: Checkup | null) {
  feedback.tap()
  editingCheckup.value = checkup
  const local = checkup ? toLocalInputValue(checkup.scheduled_at) : `${todayDateOnlyString()}T09:00`
  cDate.value = local.slice(0, 10)
  cTime.value = local.slice(11, 16)
  cReason.value = checkup?.reason ?? ''
  cNotes.value = checkup?.notes ?? ''
  checkupSheetOpen.value = true
}

async function onSaveCheckup() {
  savingCheckup.value = true
  try {
    await babies.saveCheckup(editingCheckup.value?.id ?? null, {
      scheduled_at: toUtcIso(`${cDate.value}T${cTime.value || '09:00'}`),
      reason: cReason.value.trim() || null,
      notes: cNotes.value.trim() || null,
    })
    feedback.success()
    toast.show(t('vaccinations.checkups.toastSaved'))
    checkupSheetOpen.value = false
  } catch (error) {
    toast.show(extractValidationMessage(error) ?? t('vaccinations.saveError'), 'error')
  } finally {
    savingCheckup.value = false
  }
}

async function onDeleteCheckup() {
  if (!editingCheckup.value) return
  const id = editingCheckup.value.id
  checkupSheetOpen.value = false
  try {
    await babies.deleteCheckup(id)
    toast.show(t('vaccinations.checkups.toastDeleted'))
  } catch {
    toast.show(t('vaccinations.deleteError'), 'error')
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
      <h1 class="font-display text-lg font-bold">{{ t('vaccinations.title') }}</h1>
      <span class="h-9 w-9 shrink-0"></span>
    </div>

    <div
      v-if="loading"
      class="flex flex-1 flex-col items-center justify-center gap-4 text-text-muted"
    >
      <AppMark full wiggle-toes beat-heart :size="72" />
      {{ t('common.loading') }}
    </div>

    <p
      v-else-if="!babies.current?.vaccinations_enabled"
      class="card p-4 text-center text-sm text-text-muted"
    >
      {{ t('vaccinations.disabled') }}
    </p>

    <template v-else>
      <!-- Vacunas -->
      <section class="card flex flex-col gap-3 p-4">
        <div class="flex items-center justify-between gap-2">
          <h2 class="flex items-center gap-2 font-display text-sm font-bold">
            <span class="h-4 w-1.5 shrink-0 rounded-full bg-growth"></span>
            {{ t('vaccinations.vaccinesTitle') }}
          </h2>
          <span class="text-xs font-semibold tabular-nums text-text-muted">
            {{ t('vaccinations.progress', { given: givenCount, total: requiredCount }) }}
          </span>
        </div>
        <p v-if="babies.vaccinationTemplate" class="-mt-1 text-[0.68rem] text-text-muted">
          {{
            t('vaccinations.templateSource', {
              source: babies.vaccinationTemplate.source,
              year: babies.vaccinationTemplate.year,
            })
          }}
          <template v-if="!babies.vaccinationTemplate.region_specific">
            {{ t('vaccinations.commonTemplateNote') }}</template
          >
          {{ t('vaccinations.compiledNote') }}
        </p>

        <div v-for="group in groups" :key="group.label" class="flex flex-col gap-1.5">
          <div class="text-xs font-semibold text-text-muted">{{ group.label }}</div>
          <button
            v-for="vaccination in group.items"
            :key="vaccination.id"
            type="button"
            class="card-interactive flex items-center gap-3 rounded-xl bg-surface-sunken p-3 text-left"
            @click="openVaccination(vaccination)"
          >
            <span
              class="grid h-6 w-6 shrink-0 place-items-center rounded-full border-2"
              :class="
                vaccination.given_at
                  ? 'border-growth bg-growth-strong text-white'
                  : 'border-border text-transparent'
              "
              aria-hidden="true"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="3"
                stroke-linecap="round"
                stroke-linejoin="round"
                class="h-3.5 w-3.5"
              >
                <path d="M5 13l4 4L19 7" />
              </svg>
            </span>
            <div class="min-w-0 flex-1">
              <div class="text-sm font-semibold">{{ vaccination.name }}</div>
              <div v-if="vaccination.notes" class="truncate text-xs text-text-muted">
                {{ vaccination.notes }}
              </div>
            </div>
            <span
              class="shrink-0 rounded-full px-2 py-1 text-[0.68rem] font-semibold tabular-nums"
              :class="STATUS_CLASSES[vaccinationStatus(vaccination)]"
            >
              {{ statusLabel(vaccination) }}
            </span>
          </button>
        </div>

        <button type="button" class="btn-ghost" @click="openVaccination(null)">
          {{ t('vaccinations.add') }}
        </button>
      </section>

      <!-- Revisiones -->
      <section class="card flex flex-col gap-3 p-4">
        <h2 class="flex items-center gap-2 font-display text-sm font-bold">
          <span class="h-4 w-1.5 shrink-0 rounded-full bg-sleep"></span>
          {{ t('vaccinations.checkups.title') }}
        </h2>
        <p v-if="babies.checkups.length === 0" class="py-1 text-center text-sm text-text-muted">
          {{ t('vaccinations.checkups.empty') }}
        </p>
        <button
          v-for="checkup in [...upcomingCheckups, ...pastCheckups]"
          :key="checkup.id"
          type="button"
          class="card-interactive flex items-center gap-3 rounded-xl bg-surface-sunken p-3 text-left"
          :class="new Date(checkup.scheduled_at).getTime() < Date.now() && 'opacity-60'"
          @click="openCheckup(checkup)"
        >
          <div class="min-w-0 flex-1">
            <div class="text-sm font-semibold">
              {{ checkup.reason || t('vaccinations.checkups.defaultReason') }}
            </div>
            <div v-if="checkup.notes" class="truncate text-xs text-text-muted">
              {{ checkup.notes }}
            </div>
          </div>
          <span class="shrink-0 text-xs font-semibold tabular-nums text-text-muted">
            {{ formatDateTime(checkup.scheduled_at) }}
          </span>
        </button>
        <button type="button" class="btn-ghost" @click="openCheckup(null)">
          {{ t('vaccinations.checkups.add') }}
        </button>
      </section>
    </template>

    <BottomSheet v-model:open="vaccinationSheetOpen">
      <h3 class="mb-4 font-display text-base font-bold">
        {{ editingVaccination ? editingVaccination.name : t('vaccinations.addTitle') }}
      </h3>
      <form class="flex flex-col gap-4" @submit.prevent="onSaveVaccination">
        <div v-if="!editingVaccination || editingVaccination.code === null">
          <label for="vaccination-name" class="field-label">{{ t('vaccinations.name') }}</label>
          <input
            id="vaccination-name"
            v-model="vName"
            type="text"
            required
            maxlength="255"
            class="field-input w-full min-w-0"
          />
        </div>
        <p v-if="editingVaccination?.age_label" class="-mt-2 text-xs text-text-muted">
          {{ editingVaccination.age_label }}
        </p>
        <p v-if="editingVaccination?.optional" class="-mt-2 text-xs text-text-muted">
          {{ t('vaccinations.optionalHint') }}
        </p>

        <div
          class="flex items-center justify-between gap-4 rounded-xl border border-border px-3 py-2.5"
        >
          <span class="text-sm font-medium">{{ t('vaccinations.given') }}</span>
          <button
            type="button"
            role="switch"
            :aria-checked="vGiven"
            :aria-label="t('vaccinations.given')"
            class="relative h-7 w-12 shrink-0 rounded-full transition-colors duration-150"
            :class="vGiven ? 'bg-brand' : 'bg-surface-sunken'"
            @click="vGiven = !vGiven"
          >
            <span
              class="switch-thumb absolute top-0.5 h-6 w-6 rounded-full bg-surface shadow-sm"
              :style="{ left: vGiven ? '22px' : '2px' }"
            ></span>
          </button>
        </div>
        <div v-if="vGiven">
          <label for="vaccination-given" class="field-label">{{ t('vaccinations.givenAt') }}</label>
          <input
            id="vaccination-given"
            v-model="vGivenAt"
            type="date"
            required
            :max="todayDateOnlyString()"
            class="field-input w-full min-w-0"
          />
        </div>
        <div>
          <label for="vaccination-due" class="field-label">{{ t('vaccinations.dueDate') }}</label>
          <input
            id="vaccination-due"
            v-model="vDueDate"
            type="date"
            class="field-input w-full min-w-0"
          />
        </div>
        <div>
          <label for="vaccination-notes" class="field-label">{{ t('vaccinations.notes') }}</label>
          <textarea
            id="vaccination-notes"
            v-model="vNotes"
            rows="2"
            :placeholder="t('vaccinations.notesPlaceholder')"
            class="field-input w-full min-w-0"
          ></textarea>
        </div>
        <div class="mt-1 flex gap-3">
          <button type="button" class="btn-ghost flex-1" @click="vaccinationSheetOpen = false">
            {{ t('common.cancel') }}
          </button>
          <button v-press type="submit" :disabled="savingVaccination" class="btn-primary flex-1">
            {{ savingVaccination ? t('common.saving') : t('common.save') }}
          </button>
        </div>
        <button
          v-if="editingVaccination"
          type="button"
          class="text-sm font-semibold text-danger"
          @click="onDeleteVaccination"
        >
          {{ t('vaccinations.delete') }}
        </button>
      </form>
    </BottomSheet>

    <BottomSheet v-model:open="checkupSheetOpen">
      <h3 class="mb-4 font-display text-base font-bold">
        {{ editingCheckup ? t('vaccinations.checkups.editTitle') : t('vaccinations.checkups.add') }}
      </h3>
      <form class="flex flex-col gap-4" @submit.prevent="onSaveCheckup">
        <div>
          <label for="checkup-reason" class="field-label">{{
            t('vaccinations.checkups.reason')
          }}</label>
          <input
            id="checkup-reason"
            v-model="cReason"
            type="text"
            maxlength="255"
            :placeholder="t('vaccinations.checkups.reasonPlaceholder')"
            class="field-input w-full min-w-0"
          />
        </div>
        <div>
          <label for="checkup-date" class="field-label">{{
            t('vaccinations.checkups.date')
          }}</label>
          <input
            id="checkup-date"
            v-model="cDate"
            type="date"
            required
            class="field-input w-full min-w-0"
          />
        </div>
        <div>
          <label for="checkup-time" class="field-label">{{
            t('vaccinations.checkups.time')
          }}</label>
          <input id="checkup-time" v-model="cTime" type="time" class="field-input w-full min-w-0" />
        </div>
        <div>
          <label for="checkup-notes" class="field-label">{{ t('vaccinations.notes') }}</label>
          <textarea
            id="checkup-notes"
            v-model="cNotes"
            rows="2"
            class="field-input w-full min-w-0"
          ></textarea>
        </div>
        <div class="mt-1 flex gap-3">
          <button type="button" class="btn-ghost flex-1" @click="checkupSheetOpen = false">
            {{ t('common.cancel') }}
          </button>
          <button v-press type="submit" :disabled="savingCheckup" class="btn-primary flex-1">
            {{ savingCheckup ? t('common.saving') : t('common.save') }}
          </button>
        </div>
        <button
          v-if="editingCheckup"
          type="button"
          class="text-sm font-semibold text-danger"
          @click="onDeleteCheckup"
        >
          {{ t('vaccinations.checkups.delete') }}
        </button>
      </form>
    </BottomSheet>
  </main>
</template>
