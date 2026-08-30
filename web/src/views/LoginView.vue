<script setup lang="ts">
import { ref } from 'vue'
import { useRouter, RouterLink } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'

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
  <div class="auth-form">
    <h1>{{ t('auth.login.title') }}</h1>

    <form @submit.prevent="onSubmit">
      <div>
        <label for="email">{{ t('auth.login.email') }}</label>
        <input id="email" v-model="email" type="email" required autocomplete="email" />
      </div>

      <div>
        <label for="password">{{ t('auth.login.password') }}</label>
        <input
          id="password"
          v-model="password"
          type="password"
          required
          autocomplete="current-password"
        />
      </div>

      <p v-if="error" role="alert">{{ error }}</p>

      <button type="submit" :disabled="submitting">
        {{ submitting ? t('auth.login.submitting') : t('auth.login.submit') }}
      </button>
    </form>

    <p>
      {{ t('auth.login.noAccount') }}
      <RouterLink :to="{ name: 'register' }">{{ t('auth.login.registerLink') }}</RouterLink>
    </p>
  </div>
</template>

<style scoped>
.auth-form {
  max-width: 380px;
  margin: 4rem auto 0;
}
</style>
