<script setup lang="ts" generic="T extends string">
defineProps<{ modelValue: T; options: { value: T; label: string }[] }>()
defineEmits<{ 'update:modelValue': [value: T] }>()
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
      @click="$emit('update:modelValue', option.value)"
    >
      {{ option.label }}
    </button>
  </div>
</template>
