<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { applyUpdate, updateAvailable } from '@/lib/serviceWorker'

// Aviso de "hay una versión nueva". La actualización no se aplica sola: se
// aplica al pulsar, para no recargar la app mientras alguien está registrando
// algo. Los registros pendientes de enviar están en localStorage y no se pierden.
const { t } = useI18n()
</script>

<template>
  <div
    v-if="updateAvailable"
    class="mx-4 mt-3 flex items-center justify-between gap-3 rounded-xl border border-border bg-surface-sunken p-3 text-sm"
    role="status"
  >
    <p>{{ t('update.banner') }}</p>
    <button type="button" class="btn-ghost shrink-0 !px-3 !py-1.5 text-xs" @click="applyUpdate">
      {{ t('update.apply') }}
    </button>
  </div>
</template>
