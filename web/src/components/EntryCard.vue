<script setup lang="ts">
import CategoryIcon from './CategoryIcon.vue'
import { categoryText, categoryBg, categoryRing, type Category } from '@/lib/category'

defineProps<{
  category: Category
  title: string
  meta: string
  description?: string | null
  badge?: string | null
  photoSrc?: string | null
  photoAlt?: string
}>()

defineEmits<{ open: [] }>()
</script>

<template>
  <li
    class="card-interactive flex items-center gap-3 rounded-2xl p-3 shadow-sm ring-1 ring-transparent"
    :class="[categoryBg[category], categoryRing[category]]"
  >
    <button
      type="button"
      class="group flex min-w-0 flex-1 items-center gap-3 text-left"
      @click="$emit('open')"
    >
      <img
        v-if="photoSrc"
        :src="photoSrc"
        :alt="photoAlt ?? ''"
        class="h-10 w-10 shrink-0 rounded-lg object-cover transition-transform duration-150 group-hover:scale-110"
      />
      <span
        v-else
        class="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-surface/70 transition-transform duration-150 group-hover:scale-110"
        :class="categoryText[category]"
      >
        <CategoryIcon :category="category" class="h-[1.05rem] w-[1.05rem]" />
      </span>

      <div class="min-w-0 flex-1">
        <div class="text-sm font-semibold">{{ title }}</div>
        <div class="text-xs tabular-nums text-text-muted">{{ meta }}</div>
        <div v-if="description" class="mt-0.5 text-xs text-text-muted">{{ description }}</div>
      </div>

      <span
        v-if="badge"
        class="whitespace-nowrap rounded-full bg-surface/70 px-2 py-0.5 text-xs font-bold"
        :class="categoryText[category]"
      >
        {{ badge }}
      </span>
    </button>

    <slot name="actions" />
  </li>
</template>
