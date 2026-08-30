<script setup lang="ts">
import { ref } from 'vue'
import { useRouter, RouterLink } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import PasswordField from '@/components/PasswordField.vue'

const router = useRouter()
const auth = useAuthStore()
const { t } = useI18n()

const email = ref('')
const password = ref('')
const error = ref<string | null>(null)
const submitting = ref(false)

async function onSubmit() {
  error.value = null
  submitting.value = true

  try {
    await auth.login({ email: email.value, password: password.value })
    router.push({ name: 'dashboard' })
  } catch {
    error.value = t('auth.login.error')
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <main class="flex flex-1 flex-col justify-center gap-6 px-5 py-10">
    <h1 class="text-center font-display text-2xl font-bold">{{ t('auth.login.title') }}</h1>

    <form class="card flex flex-col gap-4 p-5" @submit.prevent="onSubmit">
      <div>
        <label for="email" class="field-label">{{ t('auth.login.email') }}</label>
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
        <label for="password" class="field-label">{{ t('auth.login.password') }}</label>
        <PasswordField id="password" v-model="password" required autocomplete="current-password" />
      </div>

      <p v-if="error" role="alert" class="text-sm font-medium text-danger">{{ error }}</p>

      <button type="submit" :disabled="submitting" class="btn-primary">
        {{ submitting ? t('auth.login.submitting') : t('auth.login.submit') }}
      </button>
    </form>

    <p class="text-center text-sm text-text-muted">
      {{ t('auth.login.noAccount') }}
      <RouterLink :to="{ name: 'register' }" class="font-semibold text-brand">{{
        t('auth.login.registerLink')
      }}</RouterLink>
    </p>
  </main>
</template>
