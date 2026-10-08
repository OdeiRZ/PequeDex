<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToastStore } from '@/stores/toast'
import { useVitaminDReminder } from '@/composables/useVitaminDReminder'

const emit = defineEmits<{ openHistory: [] }>()

const { t } = useI18n()
const toast = useToastStore()
const { cardState, yesterdayAlsoMissing, markToday } = useVitaminDReminder()

const saving = ref(false)

async function onMarkGiven() {
  saving.value = true
  try {
    await markToday(true)
  } catch {
    toast.show(t('dashboard.vitaminD.markError'), 'error')
  } finally {
    saving.value = false
  }
}

async function onUndo() {
  saving.value = true
  try {
    await markToday(false)
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
          <path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z" />
          <path d="m8.5 8.5 7 7" />
        </svg>
      </span>
      <div class="min-w-0 max-w-[11.5rem]">
        <div class="text-sm font-semibold">{{ t('dashboard.vitaminD.title') }}</div>
        <div class="text-xs text-text-muted">
          {{
            yesterdayAlsoMissing
              ? t('dashboard.vitaminD.missedYesterday')
              : t('dashboard.vitaminD.pendingToday')
          }}
        </div>
        <button
          type="button"
          class="mt-0.5 text-xs font-semibold text-text-muted underline"
          @click="emit('openHistory')"
        >
          {{ t('dashboard.vitaminD.historyLink') }}
        </button>
      </div>
      <button
        type="button"
        class="shrink-0 rounded-xl bg-warning px-3 py-2 text-sm font-bold text-white disabled:opacity-60"
        :disabled="saving"
        @click="onMarkGiven"
      >
        {{ t('dashboard.vitaminD.markGiven') }}
      </button>
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
      <div class="min-w-0 flex-1">
        <div class="text-sm font-semibold">{{ t('dashboard.vitaminD.confirmedToday') }}</div>
        <button
          type="button"
          class="mt-0.5 text-xs font-semibold text-text-muted underline"
          @click="emit('openHistory')"
        >
          {{ t('dashboard.vitaminD.historyLink') }}
        </button>
      </div>
      <button
        type="button"
        class="shrink-0 text-xs font-semibold text-text-muted underline disabled:opacity-60"
        :disabled="saving"
        @click="onUndo"
      >
        {{ t('dashboard.vitaminD.undo') }}
      </button>
    </div>
  </Transition>
</template>
