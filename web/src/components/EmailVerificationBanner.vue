<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'

// Aviso de "confirma tu email". Solo sale si el API exige la confirmación
// (`email_verification_required`) y esta cuenta aún no la ha hecho; con la
// verificación apagada, que es lo habitual hoy, no se ve nunca.
const auth = useAuthStore()
const { t } = useI18n()

const visible = computed(
  () => auth.user !== null && auth.user.email_verification_required && !auth.user.email_verified_at,
)

const sending = ref(false)
const result = ref<'idle' | 'sent' | 'error'>('idle')

async function onResend() {
  sending.value = true
  result.value = 'idle'

  try {
    await auth.resendEmailVerification()
    result.value = 'sent'
  } catch {
    result.value = 'error'
  } finally {
    sending.value = false
  }
}
</script>

<template>
  <div
    v-if="visible"
    class="mx-4 mt-3 flex flex-col gap-2 rounded-xl border border-border bg-surface-sunken p-3 text-sm"
    role="status"
  >
    <p>{{ t('emailVerification.banner', { email: auth.user?.email }) }}</p>
    <div class="flex items-center gap-3">
      <button
        type="button"
        class="btn-ghost !px-3 !py-1.5 text-xs"
        :disabled="sending"
        @click="onResend"
      >
        {{ t('emailVerification.resend') }}
      </button>
      <span v-if="result === 'sent'" class="text-xs text-text-muted">{{
        t('emailVerification.sent')
      }}</span>
      <span v-else-if="result === 'error'" class="text-xs text-danger">{{
        t('emailVerification.error')
      }}</span>
    </div>
  </div>
</template>
