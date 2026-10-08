<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToastStore } from '@/stores/toast'
import { useVitaminDReminder } from '@/composables/useVitaminDReminder'

const { t } = useI18n()
const toast = useToastStore()
const { cardState, yesterdayAlsoMissing, markToday } = useVitaminDReminder()

const saving = ref(false)

async function onMark(given: boolean) {
  saving.value = true
  try {
    await markToday(given)
  } catch {
    toast.show(t('dashboard.vitaminD.markError'), 'error')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <Transition name="confirm-warn">
    <div
      v-if="cardState === 'pending'"
      class="flex items-center gap-3 rounded-2xl border border-warning/40 bg-warning/10 p-4"
      role="status"
    >
      <span
        class="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-warning/20 text-warning"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="h-5 w-5"
        >
          <path d="M12 2c3.5 4.5 6 8.09 6 11a6 6 0 0 1-12 0c0-2.91 2.5-6.5 6-11z" />
        </svg>
      </span>
      <div class="min-w-0 flex-1">
        <div class="text-sm font-semibold">{{ t('dashboard.vitaminD.title') }}</div>
        <div class="text-xs text-text-muted">
          {{
            yesterdayAlsoMissing
              ? t('dashboard.vitaminD.missedYesterday')
              : t('dashboard.vitaminD.pendingToday')
          }}
        </div>
      </div>
      <div class="flex shrink-0 gap-2">
        <button
          type="button"
          class="rounded-xl bg-warning px-3 py-2 text-xs font-bold text-white disabled:opacity-60"
          :disabled="saving"
          @click="onMark(true)"
        >
          {{ t('dashboard.vitaminD.markGiven') }}
        </button>
        <button
          type="button"
          class="rounded-xl px-2 py-2 text-xs font-semibold text-text-muted disabled:opacity-60"
          :disabled="saving"
          @click="onMark(false)"
        >
          {{ t('dashboard.vitaminD.markNotGiven') }}
        </button>
      </div>
    </div>
    <div
      v-else-if="cardState === 'confirmed'"
      class="flex items-center gap-3 rounded-2xl bg-surface-sunken p-4"
      role="status"
    >
      <span
        class="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-growth/15 text-growth"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="h-5 w-5"
        >
          <path d="M20 6L9 17l-5-5" />
        </svg>
      </span>
      <div class="min-w-0 flex-1 text-sm font-semibold">
        {{ t('dashboard.vitaminD.confirmedToday') }}
      </div>
      <button
        type="button"
        class="shrink-0 text-xs font-semibold text-text-muted underline disabled:opacity-60"
        :disabled="saving"
        @click="onMark(false)"
      >
        {{ t('dashboard.vitaminD.undo') }}
      </button>
    </div>
  </Transition>
</template>
