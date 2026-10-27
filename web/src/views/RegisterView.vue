<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter, useRoute, RouterLink } from 'vue-router'
import { useI18n } from 'vue-i18n'
import axios from 'axios'
import { useAuthStore } from '@/stores/auth'
import PasswordField from '@/components/PasswordField.vue'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()
const { t } = useI18n()

const name = ref('')
const email = ref('')
const password = ref('')
const passwordConfirmation = ref('')
// Prefilled from WelcomeView's "Tengo una invitación" when it carried an
// invite_code query param (a deep link shared by another caregiver) -
// still just a normal, editable field either way, since a code can also
// be typed by hand.
const inviteCode = ref(typeof route.query.invite_code === 'string' ? route.query.invite_code : '')
const error = ref<string | null>(null)
const submitting = ref(false)
const inviteCodeInput = ref<HTMLInputElement | null>(null)

// WelcomeView's "Tengo una invitación" marks its link with ?intent=invite
// even without a deep-linked code, so someone who wants to type one by
// hand lands with the eye already on that field instead of a form
// indistinguishable from "Crear un nuevo perfil de bebé".
onMounted(() => {
  if (route.query.intent === 'invite') {
    inviteCodeInput.value?.scrollIntoView({ block: 'center' })
    inviteCodeInput.value?.focus()
  }
})

// Shows the actual cause instead of one generic message: a bad invite code,
// an e-mail that already has an account, a password the API rejects, the
// register throttle (429) or a server/network failure.
function registerErrorMessage(err: unknown): string {
  if (!axios.isAxiosError(err)) return t('auth.register.error')
  if (!err.response) return t('auth.register.networkError')

  const { status, data } = err.response
  if (status === 429) return t('auth.register.throttled')
  if (data?.errors?.invite_code) return t('auth.register.inviteCodeError')
  if (data?.errors?.email) return t('auth.register.emailTaken')
  if (data?.errors?.password) return t('auth.register.passwordError')
  if (status >= 500) return t('auth.register.serverError')
  return t('auth.register.error')
}

async function onSubmit() {
  error.value = null
  submitting.value = true

  try {
    await auth.register({
      name: name.value,
      email: email.value,
      password: password.value,
      password_confirmation: passwordConfirmation.value,
      invite_code: inviteCode.value.trim() || undefined,
    })
    router.push({ name: 'dashboard' })
  } catch (err) {
    error.value = registerErrorMessage(err)
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <main class="flex flex-1 flex-col justify-center gap-6 px-5 py-10">
    <h1 class="text-center font-display text-2xl font-bold">{{ t('auth.register.title') }}</h1>

    <form class="card flex flex-col gap-4 p-5" @submit.prevent="onSubmit">
      <div>
        <label for="name" class="field-label">{{ t('auth.register.name') }}</label>
        <input
          id="name"
          v-model="name"
          type="text"
          required
          autocomplete="name"
          class="field-input"
        />
      </div>

      <div>
        <label for="email" class="field-label">{{ t('auth.register.email') }}</label>
        <input
          id="email"
          v-model="email"
          type="email"
          required
          autocomplete="email"
          class="field-input"
        />
      </div>

      <div>
        <label for="password" class="field-label">{{ t('auth.register.password') }}</label>
        <PasswordField id="password" v-model="password" required autocomplete="new-password" />
      </div>

      <div>
        <label for="password_confirmation" class="field-label">{{
          t('auth.register.passwordConfirmation')
        }}</label>
        <PasswordField
          id="password_confirmation"
          v-model="passwordConfirmation"
          required
          autocomplete="new-password"
        />
      </div>

      <div>
        <label for="invite_code" class="field-label">{{ t('auth.register.inviteCode') }}</label>
        <input
          id="invite_code"
          ref="inviteCodeInput"
          v-model="inviteCode"
          type="text"
          autocomplete="off"
          class="field-input"
        />
        <p class="mt-1 text-xs text-text-muted">{{ t('auth.register.inviteCodeHint') }}</p>
      </div>

      <p v-if="error" role="alert" class="text-sm font-medium text-danger">{{ error }}</p>

      <button v-press type="submit" :disabled="submitting" class="btn-primary">
        {{ submitting ? t('auth.register.submitting') : t('auth.register.submit') }}
      </button>
    </form>

    <p class="text-center text-sm text-text-muted">
      {{ t('auth.register.hasAccount') }}
      <RouterLink :to="{ name: 'login' }" class="font-semibold text-brand">{{
        t('auth.register.loginLink')
      }}</RouterLink>
    </p>
  </main>
</template>
