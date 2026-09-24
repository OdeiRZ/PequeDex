<script setup lang="ts">
import { ref } from 'vue'
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
    // Surfaces the specific "código no válido" message when that's the
    // actual cause (RegisterRequest's exists:babies,invite_code rule) -
    // the generic error otherwise, same as before this field existed.
    error.value =
      axios.isAxiosError(err) && err.response?.data?.errors?.invite_code
        ? t('auth.register.inviteCodeError')
        : t('auth.register.error')
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
