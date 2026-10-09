<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import type { DiaperSize } from '@/stores/babies'
import { useToastStore } from '@/stores/toast'
import { useUiStore } from '@/stores/ui'
import BottomSheet from '@/components/BottomSheet.vue'
import CategoryIcon from '@/components/CategoryIcon.vue'
import PasswordField from '@/components/PasswordField.vue'
import SegmentedControl from '@/components/SegmentedControl.vue'
import UserAvatar from '@/components/UserAvatar.vue'
import { useFeedback } from '@/composables/useFeedback'
import {
  ALL_CATEGORIES,
  categorySolidBg,
  MIN_ACTION_BAR_CATEGORIES,
  type Category,
} from '@/lib/category'
import { storeLocale } from '@/i18n'

// Mounted once in App.vue, a sibling of AppHeader (which opens this via
// `ui.openAccountSheet()`, a shared store flag - AppHeader is a sibling
// component, not an ancestor, so it can't reach a sheet living inside
// any one view directly). Used to live inside DashboardView.vue, which
// meant the avatar/"Tu cuenta" link only worked while that view was
// mounted - it silently did nothing from any other route (found live:
// the link went dead on /contracciones). Living here instead, next to
// AppHeader, it works from every route.
const auth = useAuthStore()
const toast = useToastStore()
const ui = useUiStore()
const feedback = useFeedback()
const { t, locale } = useI18n()

const profileName = ref('')
const profileEmail = ref('')
const savingProfile = ref(false)

// No quick toggle in the header anymore (freed up nav space) - a caregiver
// sets this once, from "Tu cuenta", the same place as everything else
// about their own account. Login/register have no account to hold a
// preference yet, so they fall back to the browser's language (see
// i18n.ts) instead of offering a switcher of their own.
const localeOptions = computed(() => [
  { value: 'es' as const, label: t('language.es') },
  { value: 'en' as const, label: t('language.en') },
])

// SegmentedControl's generic type param resolves to `string`, not
// `Locale`, because `locale` from useI18n() is itself typed as plain
// `string` (no module augmentation ties it to our own Locale union) -
// narrow it back down before storing.
function onSelectLocale(value: string) {
  if (value !== 'es' && value !== 'en') return

  locale.value = value
  storeLocale(value)
}

const currentPassword = ref('')
const newPassword = ref('')
const newPasswordConfirmation = ref('')
const savingPassword = ref(false)

const avatarInput = ref<HTMLInputElement | null>(null)
const uploadingAvatar = ref(false)

// Briefly morphs the button itself into a checkmark instead of relying
// on the toast alone - both these forms stay open after saving (unlike
// the quick-log sheets, which close immediately), so there's actually
// time for the confirmation to be seen right where the tap happened.
// The timeout that hides it again is tracked and cleared before each
// new one is scheduled - without that, saving twice in quick succession
// (the button re-enables the moment the first request resolves, well
// before its own 1300ms is up) let the *first* save's timeout hide the
// *second* save's confirmation early, cutting it down to under 200ms.
const justSavedProfile = ref(false)
const justSavedPassword = ref(false)
let justSavedProfileTimer: ReturnType<typeof setTimeout> | undefined
let justSavedPasswordTimer: ReturnType<typeof setTimeout> | undefined

async function onSubmitProfile() {
  savingProfile.value = true

  try {
    await auth.updateProfile({ name: profileName.value, email: profileEmail.value })
    toast.show(t('profile.toastSaved'))
    justSavedProfile.value = true
    clearTimeout(justSavedProfileTimer)
    justSavedProfileTimer = setTimeout(() => {
      justSavedProfile.value = false
    }, 1300)
  } catch {
    toast.show(t('profile.saveError'), 'error')
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
    justSavedPassword.value = true
    clearTimeout(justSavedPasswordTimer)
    justSavedPasswordTimer = setTimeout(() => {
      justSavedPassword.value = false
    }, 1300)
  } catch {
    toast.show(t('profile.passwordError'), 'error')
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
    toast.show(t('profile.avatarError'), 'error')
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
    toast.show(t('profile.avatarError'), 'error')
  } finally {
    uploadingAvatar.value = false
  }
}

// --- Ajustes: barra de accesos personalizable ---

const actionBarSelection = ref<Category[]>([...ALL_CATEGORIES])

// 'milestone' se filtra mientras el interruptor de "Hitos" de arriba
// esté apagado - elegirlo aquí no tendría ningún efecto visible en el
// dashboard (ver `enabledCategories` en DashboardView.vue, que aplica
// ese mismo apagado por encima de esta selección).
const actionBarToggleOptions = computed(() =>
  [
    { category: 'feed' as const, label: t('dashboard.quickLog.feed') },
    { category: 'sleep' as const, label: t('dashboard.quickLog.sleep') },
    { category: 'diaper' as const, label: t('dashboard.quickLog.diaper') },
    { category: 'growth' as const, label: t('dashboard.quickLog.growth') },
    { category: 'milestone' as const, label: t('dashboard.quickLog.milestone') },
  ].filter((option) => option.category !== 'milestone' || milestonesEnabled.value),
)

// Guardado al vuelo (como el selector de idioma), no un formulario con
// botón "Guardar" aparte. El toggle en sí es instantáneo (sin deshabilitar
// nada mientras la petición está en curso - eso es lo que hacía parpadear
// los 5 iconos en cada pulsación) y solo se deshace si el PUT falla; el
// token descarta la respuesta de una petición ya superada por un click
// más reciente sobre la misma categoría, para no revertir un estado que
// el usuario ya cambió otra vez. Si al desmarcar quedarían menos de
// MIN_ACTION_BAR_CATEGORIES, el icono se deshabilita en la plantilla en
// vez de dejar que el usuario llegue al error 422 del backend. La barra
// de accesos que de verdad se ve en el dashboard lee
// `auth.user.action_bar_categories` directamente (ver
// `DashboardView.vue`), no esta selección - son dos copias
// independientes, sincronizadas por el propio `auth.user` cuando cambia.
let actionBarSaveToken = 0

async function toggleActionBarCategory(category: Category) {
  const previous = actionBarSelection.value
  const isSelected = previous.includes(category)
  if (isSelected && previous.length <= MIN_ACTION_BAR_CATEGORIES) return

  const next = isSelected ? previous.filter((c) => c !== category) : [...previous, category]
  actionBarSelection.value = next
  feedback.tap()

  const token = ++actionBarSaveToken
  try {
    await auth.updateActionBarCategories(next)
  } catch {
    if (token === actionBarSaveToken) {
      actionBarSelection.value = previous
      toast.show(t('profile.actionBar.saveError'), 'error')
    }
  }
}

// --- Ajustes: predicciones ---

// Mismo patrón que la barra de accesos: guardado al vuelo, revertido
// solo si el PUT falla, con un token para descartar la respuesta de una
// pulsación ya superada por otra más reciente.
const predictionsEnabled = ref(true)
let predictionsSaveToken = 0

async function onTogglePredictions() {
  const previous = predictionsEnabled.value
  const next = !previous
  predictionsEnabled.value = next
  feedback.tap()

  const token = ++predictionsSaveToken
  try {
    await auth.updatePredictionsEnabled(next)
  } catch {
    if (token === predictionsSaveToken) {
      predictionsEnabled.value = previous
      toast.show(t('profile.predictions.saveError'), 'error')
    }
  }
}

// --- Ajustes: borrar con swipe ---

// Mismo patrón guardado-al-vuelo que predicciones/barra de accesos -
// desactivado por defecto (ver migración): la papelera siempre visible
// sigue siendo el comportamiento conocido hasta que alguien elige
// activamente sustituirla por el gesto.
const swipeToDeleteEnabled = ref(false)
let swipeToDeleteSaveToken = 0

async function onToggleSwipeToDelete() {
  const previous = swipeToDeleteEnabled.value
  const next = !previous
  swipeToDeleteEnabled.value = next
  feedback.tap()

  const token = ++swipeToDeleteSaveToken
  try {
    await auth.updateSwipeToDeleteEnabled(next)
  } catch {
    if (token === swipeToDeleteSaveToken) {
      swipeToDeleteEnabled.value = previous
      toast.show(t('profile.swipeToDelete.saveError'), 'error')
    }
  }
}

// --- Ajustes: tarjetas resumen del día ---

// Mismo patrón guardado-al-vuelo que los dos anteriores - activado por
// defecto (ver migración): las tarjetas ya eran visibles para todo el
// mundo antes de que existiera este ajuste.
const todaySummaryEnabled = ref(true)
let todaySummarySaveToken = 0

async function onToggleTodaySummary() {
  const previous = todaySummaryEnabled.value
  const next = !previous
  todaySummaryEnabled.value = next
  feedback.tap()

  const token = ++todaySummarySaveToken
  try {
    await auth.updateTodaySummaryEnabled(next)
  } catch {
    if (token === todaySummarySaveToken) {
      todaySummaryEnabled.value = previous
      toast.show(t('profile.todaySummary.saveError'), 'error')
    }
  }
}

// --- Ajustes: sonido y vibración al interactuar ---

// Mismo patrón guardado-al-vuelo que los tres anteriores - activado por
// defecto (ver migración). feedback.tap() en los otros tres onToggleX
// de este fichero lee este mismo ajuste en el momento de sonar/vibrar,
// así que apagarlo aquí silencia también la pulsación con la que se
// apaga (última confirmación antes del silencio, como un interruptor
// físico) sin necesitar ningún caso especial.
const interactionFeedbackEnabled = ref(true)
let interactionFeedbackSaveToken = 0

async function onToggleInteractionFeedback() {
  const previous = interactionFeedbackEnabled.value
  const next = !previous
  interactionFeedbackEnabled.value = next
  feedback.tap()

  const token = ++interactionFeedbackSaveToken
  try {
    await auth.updateInteractionFeedbackEnabled(next)
  } catch {
    if (token === interactionFeedbackSaveToken) {
      interactionFeedbackEnabled.value = previous
      toast.show(t('profile.interactionFeedback.saveError'), 'error')
    }
  }
}

// --- Ajustes: hitos ---

// Mismo patrón guardado-al-vuelo que los demás interruptores de esta
// familia - activado por defecto (ver migración): los hitos ya eran
// visibles para todo el mundo antes de que existiera este ajuste.
const milestonesEnabled = ref(true)
let milestonesEnabledSaveToken = 0

async function onToggleMilestones() {
  const previous = milestonesEnabled.value
  const next = !previous
  milestonesEnabled.value = next
  feedback.tap()

  const token = ++milestonesEnabledSaveToken
  try {
    await auth.updateMilestonesEnabled(next)
  } catch {
    if (token === milestonesEnabledSaveToken) {
      milestonesEnabled.value = previous
      toast.show(t('profile.milestonesEnabled.saveError'), 'error')
    }
  }
}

// --- Ajustes: talla de pañal por defecto ---

// A diferencia de los interruptores de arriba, esto no es un booleano
// sino "cuál de estas opciones" - mismo patrón guardado-al-vuelo, pero
// sin el booleano `next`: cada chip llama directamente con su propio
// valor (o '' para "Sin indicar"). Solo preselecciona al CREAR un
// pañal nuevo (ver `openSheet()` en DashboardView.vue) - editar uno
// existente siempre muestra su propia talla ya guardada, nunca este
// valor por defecto.
const defaultDiaperSize = ref<DiaperSize | ''>('')
let defaultDiaperSizeSaveToken = 0

async function onSelectDefaultDiaperSize(value: DiaperSize | '') {
  const previous = defaultDiaperSize.value
  if (value === previous) return
  defaultDiaperSize.value = value
  feedback.tap()

  const token = ++defaultDiaperSizeSaveToken
  try {
    await auth.updateDefaultDiaperSize(value || null)
  } catch {
    if (token === defaultDiaperSizeSaveToken) {
      defaultDiaperSize.value = previous
      toast.show(t('profile.defaultDiaperSize.saveError'), 'error')
    }
  }
}

// --- Ajustes: duración de toma al pecho por defecto ---

const DEFAULT_FEED_DURATION_OPTIONS = [10, 15, 20, 30, 45]

// Misma razón que el selector del propio formulario "+ Toma" en
// DashboardView.vue: "45+" es honesto sobre ser un cajón abierto, no
// una lectura exacta.
function feedDurationLabel(minutes: number): string {
  const isTopOption =
    minutes === DEFAULT_FEED_DURATION_OPTIONS[DEFAULT_FEED_DURATION_OPTIONS.length - 1]
  return isTopOption ? `${minutes}+ min` : `${minutes} min`
}
const defaultFeedDurationMinutes = ref<number | null>(null)
let defaultFeedDurationSaveToken = 0

async function onSelectDefaultFeedDuration(value: number | null) {
  const previous = defaultFeedDurationMinutes.value
  if (value === previous) return
  defaultFeedDurationMinutes.value = value
  feedback.tap()

  const token = ++defaultFeedDurationSaveToken
  try {
    await auth.updateDefaultFeedDuration(value)
  } catch {
    if (token === defaultFeedDurationSaveToken) {
      defaultFeedDurationMinutes.value = previous
      toast.show(t('profile.defaultFeedDuration.saveError'), 'error')
    }
  }
}

// --- Ajustes: enlaces visibles en el dashboard ---

// Mismo patrón guardado-al-vuelo que el resto - activados por defecto
// (ver migración). Solo muestran/ocultan la tarjeta de enlace
// correspondiente en el dashboard (`SoundsLinkCard.vue`/
// `StatsLinkCard.vue`); la ruta en sí (`/sonidos`/`/estadisticas`)
// sigue accesible directamente, mismo alcance que ya tiene
// `today_summary_enabled` sobre `TodaySummary.vue`.
const soundsEnabled = ref(true)
let soundsEnabledSaveToken = 0

async function onToggleSoundsEnabled() {
  const previous = soundsEnabled.value
  const next = !previous
  soundsEnabled.value = next
  feedback.tap()

  const token = ++soundsEnabledSaveToken
  try {
    await auth.updateSoundsEnabled(next)
  } catch {
    if (token === soundsEnabledSaveToken) {
      soundsEnabled.value = previous
      toast.show(t('profile.soundsEnabled.saveError'), 'error')
    }
  }
}

const statsEnabled = ref(true)
let statsEnabledSaveToken = 0

async function onToggleStatsEnabled() {
  const previous = statsEnabled.value
  const next = !previous
  statsEnabled.value = next
  feedback.tap()

  const token = ++statsEnabledSaveToken
  try {
    await auth.updateStatsEnabled(next)
  } catch {
    if (token === statsEnabledSaveToken) {
      statsEnabled.value = previous
      toast.show(t('profile.statsEnabled.saveError'), 'error')
    }
  }
}

// Reset the form fields each time the sheet opens, in response to the
// shared `ui.accountSheetOpen` flag - not at a call site, since this
// component has none of its own (AppHeader opens it via the store).
watch(
  () => ui.accountSheetOpen,
  (open) => {
    if (!open) return

    profileName.value = auth.user?.name ?? ''
    profileEmail.value = auth.user?.email ?? ''
    currentPassword.value = ''
    newPassword.value = ''
    newPasswordConfirmation.value = ''
    actionBarSelection.value = auth.user?.action_bar_categories ?? [...ALL_CATEGORIES]
    predictionsEnabled.value = auth.user?.predictions_enabled ?? true
    swipeToDeleteEnabled.value = auth.user?.swipe_to_delete_enabled ?? false
    todaySummaryEnabled.value = auth.user?.today_summary_enabled ?? true
    interactionFeedbackEnabled.value = auth.user?.interaction_feedback_enabled ?? true
    defaultDiaperSize.value = auth.user?.default_diaper_size ?? ''
    defaultFeedDurationMinutes.value = auth.user?.default_feed_duration_minutes ?? null
    soundsEnabled.value = auth.user?.sounds_enabled ?? true
    statsEnabled.value = auth.user?.stats_enabled ?? true
    milestonesEnabled.value = auth.user?.milestones_enabled ?? true
  },
)
</script>

<template>
  <BottomSheet :open="ui.accountSheetOpen" @update:open="ui.closeAccountSheet">
    <div class="mb-4 flex items-center justify-between">
      <h3 class="font-display text-base font-bold">{{ t('profile.title') }}</h3>
      <button
        type="button"
        class="text-sm font-semibold text-brand"
        @click="ui.closeAccountSheet()"
      >
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
          v-press
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
      <button
        v-press
        type="submit"
        :disabled="savingProfile"
        class="btn-primary save-btn"
        :class="justSavedProfile && 'is-saved'"
      >
        <span class="save-btn-label">{{ t('common.save') }}</span>
        <svg
          class="save-btn-check"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="3"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M5 13l4 4L19 7" />
        </svg>
      </button>
    </form>

    <div class="border-t border-border pt-5">
      <span class="field-label">{{ t('language.label') }}</span>
      <SegmentedControl
        :model-value="locale"
        :options="localeOptions"
        @update:model-value="onSelectLocale"
      />
    </div>

    <!-- Todos los interruptores on/off del perfil, en un único bloque -
         antes estaban partidos en dos grupos separados por los
         selectores de talla/duración de en medio, sin ningún motivo
         real para no estar juntos (mismo patrón de interacción los
         6 que quedan aquí - "Hitos" se mudó dentro de "Barra de
         accesos" más abajo, ver el comentario de esa sección: no era
         un ajuste genérico, era específico de esa otra sección).
         Ordenados por qué controlan: primero los que deciden qué se
         ve en el Dashboard (Predicciones, Tarjetas resumen, enlaces a
         Sonidos/Estadísticas), luego los que cambian cómo se
         comporta la interacción (swipe para borrar, sonido/
         vibración). -->
    <div class="mt-6 flex items-start justify-between gap-4 border-t border-border pt-5">
      <div>
        <span class="field-label">{{ t('profile.predictions.title') }}</span>
        <p class="text-xs text-text-muted">{{ t('profile.predictions.description') }}</p>
      </div>
      <button
        type="button"
        role="switch"
        :aria-checked="predictionsEnabled"
        :aria-label="t('profile.predictions.title')"
        class="relative h-7 w-12 shrink-0 rounded-full transition-colors duration-150"
        :class="predictionsEnabled ? 'bg-brand' : 'bg-surface-sunken'"
        @click="onTogglePredictions"
      >
        <span
          class="switch-thumb absolute top-0.5 h-6 w-6 rounded-full bg-surface shadow-sm"
          :style="{ left: predictionsEnabled ? '22px' : '2px' }"
        ></span>
      </button>
    </div>

    <div class="mt-4 flex items-start justify-between gap-4">
      <div>
        <span class="field-label">{{ t('profile.todaySummary.title') }}</span>
        <p class="text-xs text-text-muted">{{ t('profile.todaySummary.description') }}</p>
      </div>
      <button
        type="button"
        role="switch"
        :aria-checked="todaySummaryEnabled"
        :aria-label="t('profile.todaySummary.title')"
        class="relative h-7 w-12 shrink-0 rounded-full transition-colors duration-150"
        :class="todaySummaryEnabled ? 'bg-brand' : 'bg-surface-sunken'"
        @click="onToggleTodaySummary"
      >
        <span
          class="switch-thumb absolute top-0.5 h-6 w-6 rounded-full bg-surface shadow-sm"
          :style="{ left: todaySummaryEnabled ? '22px' : '2px' }"
        ></span>
      </button>
    </div>

    <div class="mt-4 flex items-start justify-between gap-4">
      <div>
        <span class="field-label">{{ t('profile.soundsEnabled.title') }}</span>
        <p class="text-xs text-text-muted">{{ t('profile.soundsEnabled.description') }}</p>
      </div>
      <button
        type="button"
        role="switch"
        :aria-checked="soundsEnabled"
        :aria-label="t('profile.soundsEnabled.title')"
        class="relative h-7 w-12 shrink-0 rounded-full transition-colors duration-150"
        :class="soundsEnabled ? 'bg-brand' : 'bg-surface-sunken'"
        @click="onToggleSoundsEnabled"
      >
        <span
          class="switch-thumb absolute top-0.5 h-6 w-6 rounded-full bg-surface shadow-sm"
          :style="{ left: soundsEnabled ? '22px' : '2px' }"
        ></span>
      </button>
    </div>

    <div class="mt-4 flex items-start justify-between gap-4">
      <div>
        <span class="field-label">{{ t('profile.statsEnabled.title') }}</span>
        <p class="text-xs text-text-muted">{{ t('profile.statsEnabled.description') }}</p>
      </div>
      <button
        type="button"
        role="switch"
        :aria-checked="statsEnabled"
        :aria-label="t('profile.statsEnabled.title')"
        class="relative h-7 w-12 shrink-0 rounded-full transition-colors duration-150"
        :class="statsEnabled ? 'bg-brand' : 'bg-surface-sunken'"
        @click="onToggleStatsEnabled"
      >
        <span
          class="switch-thumb absolute top-0.5 h-6 w-6 rounded-full bg-surface shadow-sm"
          :style="{ left: statsEnabled ? '22px' : '2px' }"
        ></span>
      </button>
    </div>

    <div class="mt-4 flex items-start justify-between gap-4">
      <div>
        <span class="field-label">{{ t('profile.swipeToDelete.title') }}</span>
        <p class="text-xs text-text-muted">{{ t('profile.swipeToDelete.description') }}</p>
      </div>
      <button
        type="button"
        role="switch"
        :aria-checked="swipeToDeleteEnabled"
        :aria-label="t('profile.swipeToDelete.title')"
        class="relative h-7 w-12 shrink-0 rounded-full transition-colors duration-150"
        :class="swipeToDeleteEnabled ? 'bg-brand' : 'bg-surface-sunken'"
        @click="onToggleSwipeToDelete"
      >
        <span
          class="switch-thumb absolute top-0.5 h-6 w-6 rounded-full bg-surface shadow-sm"
          :style="{ left: swipeToDeleteEnabled ? '22px' : '2px' }"
        ></span>
      </button>
    </div>

    <div class="mt-4 flex items-start justify-between gap-4">
      <div>
        <span class="field-label">{{ t('profile.interactionFeedback.title') }}</span>
        <p class="text-xs text-text-muted">{{ t('profile.interactionFeedback.description') }}</p>
      </div>
      <button
        type="button"
        role="switch"
        :aria-checked="interactionFeedbackEnabled"
        :aria-label="t('profile.interactionFeedback.title')"
        class="relative h-7 w-12 shrink-0 rounded-full transition-colors duration-150"
        :class="interactionFeedbackEnabled ? 'bg-brand' : 'bg-surface-sunken'"
        @click="onToggleInteractionFeedback"
      >
        <span
          class="switch-thumb absolute top-0.5 h-6 w-6 rounded-full bg-surface shadow-sm"
          :style="{ left: interactionFeedbackEnabled ? '22px' : '2px' }"
        ></span>
      </button>
    </div>

    <div class="mt-6 border-t border-border pt-5">
      <span class="field-label">{{ t('profile.actionBar.title') }}</span>
      <p class="mb-3 text-xs text-text-muted">
        {{ t('profile.actionBar.description', { min: MIN_ACTION_BAR_CATEGORIES }) }}
      </p>

      <div class="flex flex-wrap gap-3">
        <!-- "Hitos" como un chip más, mismo formato exacto que las
             categorías de abajo (icono circular + check), no un
             interruptor con pinta distinta - a diferencia de esas
             (que solo deciden si aparecen en la barra), este actúa
             por encima: con los hitos desactivados, el propio icono
             deja de ofrecerse como opción más abajo, no solo queda
             sin marcar. -->
        <button
          type="button"
          :aria-pressed="milestonesEnabled"
          :aria-label="t('profile.milestonesEnabled.title')"
          class="group flex select-none flex-col items-center gap-1.5 text-[0.65rem] font-semibold"
          :class="milestonesEnabled ? 'text-text' : 'text-text-muted'"
          @click="onToggleMilestones"
        >
          <span class="relative">
            <span
              class="grid h-11 w-11 shrink-0 place-items-center rounded-full border-2 shadow-sm transition-[transform,background-color,border-color] duration-150 ease-out group-active:scale-90"
              :class="
                milestonesEnabled
                  ? [categorySolidBg.milestone, 'border-transparent text-white']
                  : 'border-border bg-surface text-text-muted group-hover:border-text-muted'
              "
            >
              <CategoryIcon category="milestone" class="h-5 w-5" />
            </span>
            <span
              v-if="milestonesEnabled"
              class="absolute -bottom-0.5 -right-0.5 grid h-4 w-4 place-items-center rounded-full border-2 border-surface bg-brand text-white"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="3.5"
                class="h-2 w-2"
              >
                <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </span>
          </span>
          {{ t('profile.milestonesEnabled.title') }}
        </button>

        <span class="my-1 w-px self-stretch bg-border" aria-hidden="true"></span>

        <button
          v-for="option in actionBarToggleOptions"
          :key="option.category"
          type="button"
          :aria-pressed="actionBarSelection.includes(option.category)"
          :aria-label="option.label"
          :disabled="
            actionBarSelection.includes(option.category) &&
            actionBarSelection.length <= MIN_ACTION_BAR_CATEGORIES
          "
          class="group flex select-none flex-col items-center gap-1.5 text-[0.65rem] font-semibold disabled:cursor-not-allowed"
          :class="actionBarSelection.includes(option.category) ? 'text-text' : 'text-text-muted'"
          @click="toggleActionBarCategory(option.category)"
        >
          <span class="relative">
            <span
              class="grid h-11 w-11 shrink-0 place-items-center rounded-full border-2 shadow-sm transition-[transform,background-color,border-color] duration-150 ease-out group-active:scale-90 group-disabled:shadow-none"
              :class="
                actionBarSelection.includes(option.category)
                  ? [categorySolidBg[option.category], 'border-transparent text-white']
                  : 'border-border bg-surface text-text-muted group-hover:border-text-muted group-disabled:opacity-50'
              "
            >
              <CategoryIcon :category="option.category" class="h-5 w-5" />
            </span>
            <span
              v-if="actionBarSelection.includes(option.category)"
              class="absolute -bottom-0.5 -right-0.5 grid h-4 w-4 place-items-center rounded-full border-2 border-surface bg-brand text-white"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="3.5"
                class="h-2 w-2"
              >
                <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </span>
          </span>
          {{ option.label }}
        </button>
      </div>
    </div>

    <div class="mt-6 border-t border-border pt-5">
      <span class="field-label">{{ t('profile.defaultDiaperSize.title') }}</span>
      <p class="text-xs text-text-muted">{{ t('profile.defaultDiaperSize.description') }}</p>
      <div
        class="mt-2 flex flex-wrap items-center gap-2"
        role="radiogroup"
        :aria-label="t('profile.defaultDiaperSize.title')"
      >
        <button
          type="button"
          role="radio"
          class="rounded-full border-2 px-3 py-1.5 text-sm font-semibold transition-colors"
          :class="
            defaultDiaperSize === ''
              ? 'border-brand bg-brand/10 text-brand'
              : 'border-border text-text-muted'
          "
          :aria-checked="defaultDiaperSize === ''"
          @click="onSelectDefaultDiaperSize('')"
        >
          {{ t('dashboard.diaperForm.sizeUnspecified') }}
        </button>
        <button
          v-for="size in ['0', '1', '2', '3', '4', '5', '6+'] as DiaperSize[]"
          :key="size"
          type="button"
          role="radio"
          class="rounded-full border-2 px-3 py-1.5 text-sm font-semibold transition-colors"
          :class="
            defaultDiaperSize === size
              ? 'border-brand bg-brand/10 text-brand'
              : 'border-border text-text-muted'
          "
          :aria-checked="defaultDiaperSize === size"
          @click="onSelectDefaultDiaperSize(size)"
        >
          {{ size }}
        </button>
      </div>
    </div>

    <div class="mt-4">
      <span class="field-label">{{ t('profile.defaultFeedDuration.title') }}</span>
      <p class="text-xs text-text-muted">{{ t('profile.defaultFeedDuration.description') }}</p>
      <div
        class="mt-2 flex flex-wrap items-center gap-2"
        role="radiogroup"
        :aria-label="t('profile.defaultFeedDuration.title')"
      >
        <button
          type="button"
          role="radio"
          class="rounded-full border-2 px-3 py-1.5 text-sm font-semibold transition-colors"
          :class="
            defaultFeedDurationMinutes === null
              ? 'border-brand bg-brand/10 text-brand'
              : 'border-border text-text-muted'
          "
          :aria-checked="defaultFeedDurationMinutes === null"
          @click="onSelectDefaultFeedDuration(null)"
        >
          {{ t('dashboard.feedForm.durationUnspecified') }}
        </button>
        <button
          v-for="minutes in DEFAULT_FEED_DURATION_OPTIONS"
          :key="minutes"
          type="button"
          role="radio"
          class="rounded-full border-2 px-3 py-1.5 text-sm font-semibold transition-colors"
          :class="
            defaultFeedDurationMinutes === minutes
              ? 'border-brand bg-brand/10 text-brand'
              : 'border-border text-text-muted'
          "
          :aria-checked="defaultFeedDurationMinutes === minutes"
          @click="onSelectDefaultFeedDuration(minutes)"
        >
          {{ feedDurationLabel(minutes) }}
        </button>
      </div>
    </div>

    <form
      class="mt-6 flex flex-col gap-4 border-t border-border pt-5"
      @submit.prevent="onSubmitPassword"
    >
      <h4 class="-mt-1 font-display text-sm font-bold">{{ t('profile.changePassword') }}</h4>
      <div>
        <label for="current-password" class="field-label">{{ t('profile.currentPassword') }}</label>
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
      <button
        v-press
        type="submit"
        :disabled="savingPassword"
        class="btn-primary save-btn"
        :class="justSavedPassword && 'is-saved'"
      >
        <span class="save-btn-label">{{ t('profile.changePassword') }}</span>
        <svg
          class="save-btn-check"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="3"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M5 13l4 4L19 7" />
        </svg>
      </button>
    </form>
  </BottomSheet>
</template>

<style scoped>
.switch-thumb {
  transition: left 0.32s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.save-btn {
  position: relative;
}

.save-btn-label,
.save-btn-check {
  transition: opacity 0.15s ease;
}

.save-btn-check {
  position: absolute;
  inset: 0;
  margin: auto;
  width: 1.1rem;
  height: 1.1rem;
  opacity: 0;
}

.save-btn-check path {
  stroke-dasharray: 20;
  stroke-dashoffset: 20;
}

.save-btn.is-saved {
  background: var(--diaper);
  animation: save-btn-pop 0.45s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.save-btn.is-saved .save-btn-label {
  opacity: 0;
}

.save-btn.is-saved .save-btn-check {
  opacity: 1;
}

.save-btn.is-saved .save-btn-check path {
  animation: save-btn-draw-check 0.35s ease 0.1s forwards;
}

@keyframes save-btn-pop {
  0% {
    transform: scale(1);
  }
  40% {
    transform: scale(0.92);
  }
  70% {
    transform: scale(1.05);
  }
  100% {
    transform: scale(1);
  }
}

@keyframes save-btn-draw-check {
  to {
    stroke-dashoffset: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .switch-thumb {
    transition: left 0.15s ease;
  }

  .save-btn.is-saved {
    animation: none;
  }

  .save-btn.is-saved .save-btn-check path {
    animation: none;
    stroke-dashoffset: 0;
  }
}
</style>
