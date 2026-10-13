<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const auth = useAuthStore()
const { t } = useI18n()

// Los cuatro parámetros vienen del enlace del correo (ver VerifyEmailNotification
// en el API); la SPA solo los reenvía, es el API quien valida la firma.
function param(name: string): string {
  const value = route.query[name]
  return typeof value === 'string' ? value : ''
}

const state = ref<'loading' | 'done' | 'invalid'>('loading')

onMounted(async () => {
  const params = {
    id: param('id'),
    hash: param('hash'),
    expires: param('expires'),
    signature: param('signature'),
  }

  if (Object.values(params).some((value) => value === '')) {
    state.value = 'invalid'
    return
  }

  try {
    await auth.verifyEmail(params)
    state.value = 'done'
  } catch {
    state.value = 'invalid'
  }
})
</script>

<template>
  <main class="flex flex-1 flex-col justify-center gap-6 px-5 py-10">
    <h1 class="text-center font-display text-2xl font-bold">{{ t('auth.verifyEmail.title') }}</h1>

    <div class="card flex flex-col gap-4 p-5">
      <p v-if="state === 'loading'" role="status" class="text-sm">
        {{ t('auth.verifyEmail.checking') }}
      </p>

      <template v-else-if="state === 'done'">
        <p role="status" class="text-sm">{{ t('auth.verifyEmail.done') }}</p>
        <RouterLink
          :to="{ name: auth.isAuthenticated ? 'dashboard' : 'login' }"
          class="btn-primary text-center"
        >
          {{
            auth.isAuthenticated ? t('auth.verifyEmail.goToApp') : t('auth.verifyEmail.goToLogin')
          }}
        </RouterLink>
      </template>

      <template v-else>
        <p role="alert" class="text-sm text-danger">{{ t('auth.verifyEmail.invalid') }}</p>
        <RouterLink
          :to="{ name: auth.isAuthenticated ? 'dashboard' : 'login' }"
          class="btn-primary text-center"
        >
          {{
            auth.isAuthenticated ? t('auth.verifyEmail.goToApp') : t('auth.verifyEmail.goToLogin')
          }}
        </RouterLink>
      </template>
    </div>
  </main>
</template>
