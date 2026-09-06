<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const { t } = useI18n()

const email = ref('')
const error = ref<string | null>(null)
const submitted = ref(false)
const submitting = ref(false)

async function onSubmit() {
  error.value = null
  submitting.value = true

  try {
    await auth.forgotPassword(email.value)
    submitted.value = true
  } catch {
    error.value = t('auth.forgotPassword.genericError')
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <main class="flex flex-1 flex-col justify-center gap-6 px-5 py-10">
    <h1 class="text-center font-display text-2xl font-bold">
      {{ t('auth.forgotPassword.title') }}
    </h1>

    <div v-if="submitted" class="card flex flex-col gap-4 p-5">
      <p role="status" class="text-sm">{{ t('auth.forgotPassword.successMessage') }}</p>
      <RouterLink :to="{ name: 'login' }" class="btn-primary text-center">
        {{ t('auth.forgotPassword.backToLogin') }}
      </RouterLink>
    </div>

    <form v-else class="card flex flex-col gap-4 p-5" @submit.prevent="onSubmit">
      <p class="text-sm text-text-muted">{{ t('auth.forgotPassword.instructions') }}</p>

      <div>
        <label for="email" class="field-label">{{ t('auth.forgotPassword.email') }}</label>
        <input
          id="email"
          v-model="email"
          type="email"
          required
          autocomplete="email"
          class="field-input"
        />
      </div>

      <p v-if="error" role="alert" class="text-sm font-medium text-danger">{{ error }}</p>

      <button type="submit" :disabled="submitting" class="btn-primary">
        {{ submitting ? t('auth.forgotPassword.submitting') : t('auth.forgotPassword.submit') }}
      </button>
    </form>

    <p v-if="!submitted" class="text-center text-sm text-text-muted">
      <RouterLink :to="{ name: 'login' }" class="font-semibold text-brand">{{
        t('auth.forgotPassword.backToLogin')
      }}</RouterLink>
    </p>
  </main>
</template>
