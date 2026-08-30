<script setup lang="ts">
import CategoryIcon from './CategoryIcon.vue'
import DeleteButton from './DeleteButton.vue'
import { categoryText, categoryBg } from '@/lib/category'
import { milestoneCategoryEmoji } from '@/lib/milestoneCategory'
import type { MilestoneCategory } from '@/stores/babies'

const props = defineProps<{
  title: string
  meta: string
  category?: MilestoneCategory | null
  description?: string | null
  photoSrc?: string | null
  photoAlt?: string
}>()

defineEmits<{ open: []; delete: [] }>()
</script>

<template>
  <li class="relative overflow-hidden rounded-2xl bg-surface shadow-sm">
    <span
      v-if="category"
      class="absolute top-2 left-2 z-10 grid h-7 w-7 place-items-center rounded-full bg-surface/90 text-base shadow-sm"
    >
      {{ milestoneCategoryEmoji[category] }}
    </span>
    <button type="button" class="block w-full" @click="$emit('open')">
      <img
        v-if="photoSrc"
        :src="photoSrc"
        :alt="photoAlt ?? ''"
        class="aspect-[4/3] w-full object-cover"
      />
      <div
        v-else
        class="flex aspect-[4/3] w-full items-center justify-center text-4xl"
        :class="categoryBg.milestone"
      >
        <span v-if="props.category">{{ milestoneCategoryEmoji[props.category] }}</span>
        <CategoryIcon
          v-else
          category="milestone"
          class="h-10 w-10"
          :class="categoryText.milestone"
        />
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
