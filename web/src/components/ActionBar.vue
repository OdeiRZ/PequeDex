<script setup lang="ts">
import CategoryIcon from './CategoryIcon.vue'
import { categoryText, categoryBg, type Category } from '@/lib/category'

defineProps<{ items: { category: Category; label: string }[] }>()
defineEmits<{ select: [category: Category] }>()
</script>

<template>
  <nav
    class="sticky bottom-0 z-10 grid grid-cols-5 gap-1 border-t border-border bg-surface p-2"
    style="padding-bottom: calc(0.5rem + env(safe-area-inset-bottom))"
  >
    <button
      v-for="item in items"
      :key="item.category"
      type="button"
      class="flex flex-col items-center gap-1 rounded-xl px-1 py-1.5 text-[0.65rem] font-semibold text-text-muted transition-colors"
      @click="$emit('select', item.category)"
    >
      <span
        class="grid h-7 w-7 place-items-center rounded-lg transition-colors"
        :class="[categoryText[item.category], categoryBg[item.category]]"
      >
        <CategoryIcon :category="item.category" class="h-4 w-4" />
      </span>
      {{ item.label }}
    </button>
  </nav>
</template>
