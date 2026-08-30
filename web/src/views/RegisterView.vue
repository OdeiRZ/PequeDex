<script setup lang="ts">
import { ref } from 'vue'
import { useRouter, RouterLink } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'

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
  <div class="auth-form">
    <h1>{{ t('auth.register.title') }}</h1>

    <form @submit.prevent="onSubmit">
      <div>
        <label for="name">{{ t('auth.register.name') }}</label>
        <input id="name" v-model="name" type="text" required autocomplete="name" />
      </div>

      <div>
        <label for="email">{{ t('auth.register.email') }}</label>
        <input id="email" v-model="email" type="email" required autocomplete="email" />
      </div>

      <div>
        <label for="password">{{ t('auth.register.password') }}</label>
        <input
          id="password"
          v-model="password"
          type="password"
          required
          autocomplete="new-password"
        />
      </div>

      <div>
        <label for="password_confirmation">{{ t('auth.register.passwordConfirmation') }}</label>
        <input
          id="password_confirmation"
          v-model="passwordConfirmation"
          type="password"
          required
          autocomplete="new-password"
        />
      </div>

      <p v-if="error" role="alert">{{ error }}</p>

      <button type="submit" :disabled="submitting">
        {{ submitting ? t('auth.register.submitting') : t('auth.register.submit') }}
      </button>
    </form>

    <p>
      {{ t('auth.register.hasAccount') }}
      <RouterLink :to="{ name: 'login' }">{{ t('auth.register.loginLink') }}</RouterLink>
    </p>
  </div>
</template>

<style scoped>
.auth-form {
  max-width: 380px;
  margin: 4rem auto 0;
}
</style>
