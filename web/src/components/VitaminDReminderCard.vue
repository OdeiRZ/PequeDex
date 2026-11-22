<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToastStore } from '@/stores/toast'
import { useVitaminDReminder } from '@/composables/useVitaminDReminder'
import { formatWeekdayShortDateLabel, parseDateOnly } from '@/lib/localDate'

// `day`: el día abierto en "Ritmo" (YYYY-MM-DD). La tarjeta dice si se dio
// la vitamina ese día y "Dar"/"Deshacer" lo marcan.
const props = defineProps<{ day: string }>()
const emit = defineEmits<{ openHistory: [] }>()

const { t, locale } = useI18n()
const toast = useToastStore()
const { isToday, cardState, markedNotGiven, dayBeforeAlsoMissing, markDay } = useVitaminDReminder(
  () => props.day,
)

// "lun 16 nov" / "Mon 16 Nov", para los textos de un día que no es hoy: en
// español el día de la semana va en minúscula dentro de la frase.
const dayLabel = computed(() => {
  const es = locale.value === 'es'
  const label = formatWeekdayShortDateLabel(parseDateOnly(props.day), es ? 'es-ES' : 'en-GB')
  return es ? label.charAt(0).toLowerCase() + label.slice(1) : label
})

const pendingText = computed(() => {
  if (isToday.value) {
    return dayBeforeAlsoMissing.value
      ? t('dashboard.vitaminD.missedYesterday')
      : t('dashboard.vitaminD.pendingToday')
  }
  if (markedNotGiven.value) return t('dashboard.vitaminD.notGivenDay', { day: dayLabel.value })
  return dayBeforeAlsoMissing.value
    ? t('dashboard.vitaminD.missedDayBefore', { day: dayLabel.value })
    : t('dashboard.vitaminD.pendingDay', { day: dayLabel.value })
})

const confirmedText = computed(() =>
  isToday.value
    ? t('dashboard.vitaminD.confirmedToday')
    : t('dashboard.vitaminD.confirmedDay', { day: dayLabel.value }),
)

const saving = ref(false)

async function onMarkGiven() {
  saving.value = true
  try {
    await markDay(true)
  } catch {
    toast.show(t('dashboard.vitaminD.markError'), 'error')
  } finally {
    saving.value = false
  }
}

async function onUndo() {
  saving.value = true
  try {
    await markDay(false)
  } catch {
    toast.show(t('dashboard.vitaminD.markError'), 'error')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <!-- Duración explícita: la raíz recibe `dash-enter` desde el Dashboard, cuya
       animación de entrada ya terminó; sin esto Vue esperaba su `animationend`
       para retirar la tarjeta que sale y nunca llegaba, así que "Dar" y "dada"
       se quedaban las dos en pantalla (p. ej. al abrir con la foto de ayer y
       llegar los datos de hoy). `out-in`: nunca se ven las dos a la vez. -->
  <Transition name="confirm-warn" mode="out-in" :duration="{ enter: 300, leave: 150 }">
    <div
      v-if="cardState === 'pending'"
      class="flex items-center gap-2.5 rounded-2xl border border-warning/40 bg-warning/10 p-3"
      role="status"
    >
      <span
        class="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-warning/20 text-warning"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="h-[1.05rem] w-[1.05rem]"
        >
          <path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z" />
          <path d="m8.5 8.5 7 7" />
        </svg>
      </span>
      <!-- Ancho en % del bloque, no fijo: "Dar" queda en el mismo punto
           relativo a cualquier ancho de pantalla (58% = los 184px de
           antes en un móvil de 375px). -->
      <div class="min-w-0 max-w-[58%] flex-1">
        <div class="text-sm font-semibold">{{ t('dashboard.vitaminD.title') }}</div>
        <div class="text-xs text-text-muted">
          {{ pendingText }}
          <button
            type="button"
            class="tap-area ml-1.5 inline-block border-0 p-0 align-top font-semibold leading-none underline"
            @click="emit('openHistory')"
          >
            {{ t('dashboard.vitaminD.historyLink') }}
          </button>
        </div>
      </div>
      <button
        type="button"
        class="shrink-0 rounded-xl bg-warning-strong px-3 py-2 text-sm font-bold text-white disabled:opacity-60"
        :disabled="saving"
        @click="onMarkGiven"
      >
        {{ t('dashboard.vitaminD.markGiven') }}
      </button>
    </div>
    <div
      v-else-if="cardState === 'confirmed'"
      class="flex items-center gap-2.5 rounded-2xl bg-surface-sunken p-3"
      role="status"
    >
      <span class="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-growth/15 text-growth">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="h-[1.05rem] w-[1.05rem]"
        >
          <path d="M20 6L9 17l-5-5" />
        </svg>
      </span>
      <div class="min-w-0 flex-1">
        <div class="text-sm font-semibold">{{ confirmedText }}</div>
        <button
          type="button"
          class="tap-area mt-0.5 inline-block border-0 p-0 text-xs font-semibold leading-none text-text-muted underline"
          @click="emit('openHistory')"
        >
          {{ t('dashboard.vitaminD.historyLink') }}
        </button>
      </div>
      <button
        type="button"
        class="tap-area mr-[6%] shrink-0 self-center border-0 p-0 text-xs font-semibold leading-none text-text-muted underline disabled:opacity-60"
        :disabled="saving"
        @click="onUndo"
      >
        {{ t('dashboard.vitaminD.undo') }}
      </button>
    </div>
  </Transition>
</template>
