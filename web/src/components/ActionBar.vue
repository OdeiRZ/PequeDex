<script setup lang="ts">
import { computed } from 'vue'
import CategoryIcon from './CategoryIcon.vue'
import { categoryText, categoryBg, type Category } from '@/lib/category'

const props = defineProps<{ items: { category: Category; label: string }[] }>()
defineEmits<{ select: [category: Category] }>()

// Tailwind can't interpolate an arbitrary count into `grid-cols-{n}` at
// build time, and with fewer items the freed-up space goes into visibly
// bigger touch targets rather than sitting empty - a lookup keyed by the
// (3-5, per the min-3 rule in the account sheet) item count. The jump
// from 5 to 3 is deliberately steep (icon wrapper nearly doubles) so
// removing items reads as "fewer, bigger" rather than a barely-there
// nudge.
interface SizeConfig {
  gridCols: string
  padding: string
  gap: string
  wrapper: string
  icon: string
  text: string
}

// Literal keys (not `Record<number, ...>`) so TS knows every lookup
// below is defined - a plain number index would type as possibly
// `undefined` under noUncheckedIndexedAccess even for a key we just
// clamped into range.
const SIZES: Record<3 | 4 | 5, SizeConfig> = {
  3: {
    gridCols: 'grid-cols-3',
    padding: 'p-3',
    gap: 'gap-1.5',
    wrapper: 'h-14 w-14',
    icon: 'h-7 w-7',
    text: 'text-xs',
  },
  4: {
    gridCols: 'grid-cols-4',
    padding: 'p-2.5',
    gap: 'gap-1',
    wrapper: 'h-11 w-11',
    icon: 'h-5 w-5',
    text: 'text-[0.7rem]',
  },
  5: {
    gridCols: 'grid-cols-5',
    padding: 'p-2',
    gap: 'gap-1',
    wrapper: 'h-8 w-8',
    icon: 'h-4 w-4',
    text: 'text-[0.65rem]',
  },
}

const sizes = computed(() => {
  const count = props.items.length
  return SIZES[count === 3 || count === 4 ? count : 5]
})
</script>

<template>
  <!-- Teleported to <body> and genuinely `fixed`, not `sticky` - it used
       to be rendered inline near the very end of the page (after the
       whole timeline/growth/milestones flow), so `sticky` only ever
       engaged once scrolled almost to the bottom of a long dashboard.
       Now it floats over the content from the moment the dashboard
       renders, same technique as ContractionsView's own floating
       buttons (Teleport avoids depending on no ancestor ever getting a
       `transform`). -->
  <Teleport to="body">
    <div
      class="fixed inset-x-0 bottom-0 z-20 mx-auto w-full max-w-md px-4"
      style="padding-bottom: calc(0.75rem + env(safe-area-inset-bottom))"
    >
      <nav
        class="grid gap-1 rounded-full bg-surface shadow-[0_14px_30px_-12px_rgba(0,0,0,0.35)] transition-[padding] duration-150"
        :class="[sizes.gridCols, sizes.padding]"
      >
        <button
          v-for="item in items"
          :key="item.category"
          type="button"
          class="flex flex-col items-center rounded-full px-1 py-1.5 font-semibold text-text-muted transition-colors"
          :class="[sizes.gap, sizes.text]"
          @click="$emit('select', item.category)"
        >
          <span
            class="grid place-items-center rounded-full transition-[height,width] duration-150"
            :class="[categoryText[item.category], categoryBg[item.category], sizes.wrapper]"
          >
            <CategoryIcon
              :category="item.category"
              class="transition-[height,width] duration-150"
              :class="sizes.icon"
            />
          </span>
          {{ item.label }}
        </button>
      </nav>
    </div>
  </Teleport>
</template>
