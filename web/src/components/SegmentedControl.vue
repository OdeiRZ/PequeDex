<script setup lang="ts" generic="T extends string">
import { useFeedback } from '@/composables/useFeedback'

const props = defineProps<{ modelValue: T; options: { value: T; label: string }[] }>()
const emit = defineEmits<{ 'update:modelValue': [value: T] }>()
const feedback = useFeedback()

function onSelect(value: T) {
  // Sin sonido/vibración si se vuelve a tocar la opción ya activa - no
  // hay cambio real que confirmar.
  if (value !== props.modelValue) feedback.select()
  emit('update:modelValue', value)
}
</script>

<template>
  <div
    class="grid gap-1 rounded-xl bg-surface-sunken p-1"
    :style="{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }"
    role="group"
  >
    <button
      v-for="option in options"
      :key="option.value"
      type="button"
      class="rounded-lg px-2 py-2 text-sm font-semibold transition-colors"
      :class="modelValue === option.value ? 'bg-surface text-brand shadow-sm' : 'text-text-muted'"
      :aria-pressed="modelValue === option.value"
      @click="onSelect(option.value)"
    >
      {{ option.label }}
    </button>
  </div>
</template>
