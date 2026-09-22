<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import { useToastStore } from '@/stores/toast'
import { useUiStore } from '@/stores/ui'
import BottomSheet from '@/components/BottomSheet.vue'
import CategoryIcon from '@/components/CategoryIcon.vue'
import PasswordField from '@/components/PasswordField.vue'
import SegmentedControl from '@/components/SegmentedControl.vue'
import UserAvatar from '@/components/UserAvatar.vue'
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

const actionBarToggleOptions = computed(() => [
  { category: 'feed' as const, label: t('dashboard.quickLog.feed') },
  { category: 'sleep' as const, label: t('dashboard.quickLog.sleep') },
  { category: 'diaper' as const, label: t('dashboard.quickLog.diaper') },
  { category: 'growth' as const, label: t('dashboard.quickLog.growth') },
  { category: 'milestone' as const, label: t('dashboard.quickLog.milestone') },
])

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

    <div class="mt-6 border-t border-border pt-5">
      <span class="field-label">{{ t('profile.actionBar.title') }}</span>
      <p class="mb-3 text-xs text-text-muted">
        {{ t('profile.actionBar.description', { min: MIN_ACTION_BAR_CATEGORIES }) }}
      </p>
      <div class="flex flex-wrap gap-3">
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
