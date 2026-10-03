<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import WheelColumn from './WheelColumn.vue'
import { addDays, parseDateOnly, todayDateOnlyString } from '@/lib/localDate'

// Sustituye al <input type="datetime-local"> nativo en los formularios de
// registro rápido (toma/pañal/inicio de sueño) - el nativo abre un selector
// que dibuja el propio sistema operativo, fuera del DOM de la página, así
// que no hay forma de engañarle un sonido por cada fila mientras se
// desliza (solo un evento al confirmar). Este, al ser tres `WheelColumn`
// normales (que ya suenan solos, ver su propio componente), lo consigue
// gratis sin tocar nada más.
//
// El modelo sigue siendo el mismo string "YYYY-MM-DDTHH:mm" que ya produce
// un datetime-local, para no tocar el resto del formulario (toUtcIso(),
// toLocalInputValue(), nowForInput()...) - solo cambia cómo se recoge.
//
// NO sustituye al campo "Fin del sueño" (sleepEndedAt en DashboardView.vue):
// ese campo puede quedar vacío a propósito ("sigue durmiendo"), algo que
// una rueda no representa sin un interruptor aparte - se queda con el
// datetime-local nativo de siempre.
const props = defineProps<{
  modelValue: string
  /** Mismo formato que modelValue, opcional - día más antiguo seleccionable
   * (nacimiento del bebé, inicio del sueño para su propio fin...). Solo
   * acota el DÍA, no la hora exacta dentro de ese día - violar la hora
   * exacta del mínimo (p.ej. un fin de sueño antes que su propio inicio,
   * mismo día) lo sigue atrapando la validación del backend al guardar,
   * igual que cualquier otro error de ese formulario. */
  min?: string
  dateLocale: string
  ariaLabel: string
}>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const { t } = useI18n()

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

function emitCombined(day: string, hour: number, minute: number) {
  emit('update:modelValue', `${day}T${pad(hour)}:${pad(minute)}`)
}

const dayValue = computed({
  get: () => props.modelValue.slice(0, 10),
  set: (day: string) => emitCombined(day, hourValue.value, minuteValue.value),
})
const hourValue = computed({
  get: () => Number(props.modelValue.slice(11, 13)) || 0,
  set: (hour: number) => emitCombined(dayValue.value, hour, minuteValue.value),
})
const minuteValue = computed({
  get: () => Number(props.modelValue.slice(14, 16)) || 0,
  set: (minute: number) => emitCombined(dayValue.value, hourValue.value, minute),
})

// 90 días hacia atrás por defecto cuando no hay `min` (p.ej. el bebé
// todavía no tiene fecha de nacimiento registrada) - suficiente para
// cualquier registro tardío realista sin generar una lista absurdamente
// larga. Si `min` cae más lejos que eso (el caso normal: nacimiento del
// bebé), manda `min` igualmente - mejor una rueda larga que no dejar
// llegar a un día que sí debería poder elegirse.
const DAY_LOOKBACK_FALLBACK = 90

const dayOptions = computed(() => {
  const today = todayDateOnlyString()
  const floor = props.min ? props.min.slice(0, 10) : addDays(today, -DAY_LOOKBACK_FALLBACK)
  const yesterday = addDays(today, -1)

  // El valor actual puede caer fuera de este rango (editando un registro
  // ya antiguo, p.ej.) - se incluye igualmente en vez de recortarlo
  // silenciosamente de la lista, que dejaría la rueda sin ninguna fila
  // marcada como seleccionada.
  const start = dayValue.value < floor ? dayValue.value : floor
  const end = dayValue.value > today ? dayValue.value : today

  const options: { value: string; label: string }[] = []
  for (let day = start; day <= end; day = addDays(day, 1)) {
    const label =
      day === today
        ? t('dashboard.dateTimeWheel.today')
        : day === yesterday
          ? t('dashboard.dateTimeWheel.yesterday')
          : parseDateOnly(day).toLocaleDateString(props.dateLocale, {
              day: 'numeric',
              month: 'short',
            })
    options.push({ value: day, label })
  }
  return options
})

const hourOptions = Array.from({ length: 24 }, (_, hour) => ({ value: hour, label: pad(hour) }))
const minuteOptions = Array.from({ length: 60 }, (_, minute) => ({
  value: minute,
  label: pad(minute),
}))
</script>

<template>
  <div class="flex gap-2">
    <WheelColumn
      v-model="dayValue"
      class="flex-[1.6]"
      :items="dayOptions"
      :ariaLabel="`${ariaLabel} - ${t('dashboard.dateTimeWheel.day')}`"
    />
    <WheelColumn
      v-model="hourValue"
      class="flex-1"
      :items="hourOptions"
      :ariaLabel="`${ariaLabel} - ${t('dashboard.dateTimeWheel.hour')}`"
    />
    <WheelColumn
      v-model="minuteValue"
      class="flex-1"
      :items="minuteOptions"
      :ariaLabel="`${ariaLabel} - ${t('dashboard.dateTimeWheel.minute')}`"
    />
  </div>
</template>
