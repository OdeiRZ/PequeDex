<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, RouterLink } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import PasswordField from '@/components/PasswordField.vue'

const route = useRoute()
const auth = useAuthStore()
const { t } = useI18n()

// Both come from the link the password-reset email points at (see the
// API's AppServiceProvider) - a query string rather than route params
// since Laravel's own Password::reset() needs both to look up the token.
const token = typeof route.query.token === 'string' ? route.query.token : ''
const email = typeof route.query.email === 'string' ? route.query.email : ''

const password = ref('')
const passwordConfirmation = ref('')
const error = ref<string | null>(null)
const submitted = ref(false)
const submitting = ref(false)

async function onSubmit() {
  error.value = null
  submitting.value = true

  try {
    await auth.resetPassword({
      token,
      email,
      password: password.value,
      password_confirmation: passwordConfirmation.value,
    })
    submitted.value = true
  } catch {
    error.value = t('auth.resetPassword.genericError')
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <main class="flex flex-1 flex-col justify-center gap-6 px-5 py-10">
    <h1 class="text-center font-display text-2xl font-bold">{{ t('auth.resetPassword.title') }}</h1>

    <div v-if="submitted" class="card flex flex-col gap-4 p-5">
      <p role="status" class="text-sm">{{ t('auth.resetPassword.successMessage') }}</p>
      <RouterLink :to="{ name: 'login' }" class="btn-primary text-center">
        {{ t('auth.resetPassword.goToLogin') }}
      </RouterLink>
    </div>

    <form v-else class="card flex flex-col gap-4 p-5" @submit.prevent="onSubmit">
      <div>
        <label for="password" class="field-label">{{ t('auth.resetPassword.password') }}</label>
        <PasswordField id="password" v-model="password" required autocomplete="new-password" />
      </div>

      <div>
        <label for="password_confirmation" class="field-label">{{
          t('auth.resetPassword.passwordConfirmation')
        }}</label>
        <PasswordField
          id="password_confirmation"
          v-model="passwordConfirmation"
          required
          autocomplete="new-password"
        />
      </div>

      <p v-if="error" role="alert" class="text-sm font-medium text-danger">{{ error }}</p>

      <button type="submit" :disabled="submitting" class="btn-primary">
        {{ submitting ? t('auth.resetPassword.submitting') : t('auth.resetPassword.submit') }}
      </button>
    </form>
  </main>
</template>
