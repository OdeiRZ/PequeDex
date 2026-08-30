<script setup lang="ts">
import { ref } from 'vue'
import { useRouter, RouterLink } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import PasswordField from '@/components/PasswordField.vue'

const router = useRouter()
const auth = useAuthStore()
const { t } = useI18n()

const name = ref('')
const email = ref('')
const password = ref('')
const passwordConfirmation = ref('')
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
    })
    router.push({ name: 'dashboard' })
  } catch {
    error.value = t('auth.register.error')
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

      <p v-if="error" role="alert" class="text-sm font-medium text-danger">{{ error }}</p>

      <button type="submit" :disabled="submitting" class="btn-primary">
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
