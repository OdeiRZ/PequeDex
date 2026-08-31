<script setup lang="ts">
import CategoryIcon from './CategoryIcon.vue'
import { categoryText, categoryBg, type Category } from '@/lib/category'

defineProps<{ items: { category: Category; label: string }[] }>()
defineEmits<{ select: [category: Category] }>()
</script>

<template>
  <nav
    class="sticky z-10 mx-4 grid grid-cols-5 gap-1 rounded-full bg-surface p-2 shadow-[0_14px_30px_-12px_rgba(0,0,0,0.35)]"
    style="bottom: calc(0.75rem + env(safe-area-inset-bottom))"
  >
    <button
      v-for="item in items"
      :key="item.category"
      type="button"
      class="flex flex-col items-center gap-1 rounded-full px-1 py-1.5 text-[0.65rem] font-semibold text-text-muted transition-colors"
      @click="$emit('select', item.category)"
    >
      <span
        class="grid h-8 w-8 place-items-center rounded-full transition-colors"
        :class="[categoryText[item.category], categoryBg[item.category]]"
      >
        <CategoryIcon :category="item.category" class="h-4 w-4" />
      </span>
      {{ item.label }}
    </button>
  </nav>
</template>
