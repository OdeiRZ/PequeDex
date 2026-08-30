<script setup lang="ts">
import CategoryIcon from './CategoryIcon.vue'
import DeleteButton from './DeleteButton.vue'
import { categoryText, categoryBg } from '@/lib/category'

defineProps<{
  title: string
  meta: string
  description?: string | null
  photoSrc?: string | null
  photoAlt?: string
}>()

defineEmits<{ open: []; delete: [] }>()
</script>

<template>
  <li class="overflow-hidden rounded-2xl bg-surface shadow-sm">
    <button type="button" class="block w-full" @click="$emit('open')">
      <img
        v-if="photoSrc"
        :src="photoSrc"
        :alt="photoAlt ?? ''"
        class="aspect-[4/3] w-full object-cover"
      />
      <div
        v-else
        class="flex aspect-[4/3] w-full items-center justify-center"
        :class="categoryBg.milestone"
      >
        <CategoryIcon category="milestone" class="h-10 w-10" :class="categoryText.milestone" />
      </div>
    </button>

    <div class="flex items-start gap-2 p-3">
      <button type="button" class="min-w-0 flex-1 text-left" @click="$emit('open')">
        <div class="text-sm font-semibold">{{ title }}</div>
        <div class="text-xs tabular-nums text-text-muted">{{ meta }}</div>
        <p v-if="description" class="mt-0.5 line-clamp-2 text-xs text-text-muted">
          {{ description }}
        </p>
      </button>

      <DeleteButton @click="$emit('delete')" />
    </div>
  </li>
</template>
