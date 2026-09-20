<script setup lang="ts">
import { computed } from 'vue'
import CategoryIcon from './CategoryIcon.vue'
import { categoryText, categoryBg, type Category } from '@/lib/category'

const props = defineProps<{ items: { category: Category; label: string }[] }>()
defineEmits<{ select: [category: Category] }>()

// Tailwind can't interpolate an arbitrary count into `grid-cols-{n}` at
// build time, and with fewer items the icons grow a bit to fill the
// freed-up space rather than leaving it empty - a lookup keyed by the
// (3-5, per the min-3 rule in the account sheet) item count.
const SIZES: Record<number, { gridCols: string; wrapper: string; icon: string }> = {
  3: { gridCols: 'grid-cols-3', wrapper: 'h-10 w-10', icon: 'h-5 w-5' },
  4: { gridCols: 'grid-cols-4', wrapper: 'h-9 w-9', icon: 'h-[1.1rem] w-[1.1rem]' },
  5: { gridCols: 'grid-cols-5', wrapper: 'h-8 w-8', icon: 'h-4 w-4' },
}

const sizes = computed(() => SIZES[props.items.length] ?? SIZES[5])
</script>

<template>
  <nav
    class="sticky z-10 mx-4 grid gap-1 rounded-full bg-surface p-2 shadow-[0_14px_30px_-12px_rgba(0,0,0,0.35)]"
    :class="sizes.gridCols"
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
        class="grid place-items-center rounded-full transition-colors"
        :class="[categoryText[item.category], categoryBg[item.category], sizes.wrapper]"
      >
        <CategoryIcon :category="item.category" :class="sizes.icon" />
      </span>
      {{ item.label }}
    </button>
  </nav>
</template>
