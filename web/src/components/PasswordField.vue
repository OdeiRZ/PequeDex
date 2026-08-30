<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

defineProps<{
  id: string
  modelValue: string
  autocomplete?: string
  required?: boolean
}>()
defineEmits<{ 'update:modelValue': [value: string] }>()

const { t } = useI18n()
const visible = ref(false)
</script>

<template>
  <div class="relative">
    <input
      :id="id"
      :value="modelValue"
      :type="visible ? 'text' : 'password'"
      :required="required"
      :autocomplete="autocomplete"
      class="field-input pr-10"
      @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    />
    <button
      type="button"
      class="absolute inset-y-0 right-0 grid w-10 place-items-center text-text-muted"
      :aria-label="visible ? t('common.hidePassword') : t('common.showPassword')"
      @click="visible = !visible"
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
        <template v-if="visible">
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
          <circle cx="12" cy="12" r="3" />
        </template>
        <template v-else>
          <path
            d="M3 3l18 18M10.6 10.6a3 3 0 0 0 4.24 4.24M9.9 5.1A10.8 10.8 0 0 1 12 5c6.5 0 10 7 10 7a13.9 13.9 0 0 1-3.17 4.14M6.5 6.5C4.2 8 2 12 2 12a13.6 13.6 0 0 0 4.6 5.2A10.6 10.6 0 0 0 12 19c1 0 1.96-.14 2.85-.4"
          />
        </template>
      </svg>
    </button>
  </div>
</template>
