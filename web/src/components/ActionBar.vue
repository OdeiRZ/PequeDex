<script setup lang="ts">
import { computed } from 'vue'
import CategoryIcon from './CategoryIcon.vue'
import { categoryText, categoryBg, type Category } from '@/lib/category'

const props = defineProps<{ items: { category: Category; label: string }[] }>()
const emit = defineEmits<{ select: [category: Category] }>()

// A ripple from the exact point touched, not the button's center - same
// idea as Android's own ripple, done here in plain CSS/JS since nothing
// else in the app pulls in a UI library for a single effect. Cleans
// itself up after the animation instead of accumulating spans.
function onTap(event: MouseEvent, category: Category) {
  const button = event.currentTarget as HTMLElement
  const rect = button.getBoundingClientRect()
  const size = Math.max(rect.width, rect.height) * 1.6
  // event.detail === 0 means this click came from the keyboard (Enter/
  // Space), not a pointer - clientX/Y would be 0 then, which would
  // otherwise pin the ripple to the button's top-left corner instead of
  // its center.
  const originX = event.detail === 0 ? rect.left + rect.width / 2 : event.clientX
  const originY = event.detail === 0 ? rect.top + rect.height / 2 : event.clientY
  const ripple = document.createElement('span')
  ripple.className = 'action-ripple'
  ripple.style.width = ripple.style.height = `${size}px`
  ripple.style.left = `${originX - rect.left - size / 2}px`
  ripple.style.top = `${originY - rect.top - size / 2}px`
  button.appendChild(ripple)
  ripple.addEventListener('animationend', () => ripple.remove())

  emit('select', category)
}

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
          class="group flex flex-col items-center rounded-full px-1 py-1.5 font-semibold text-text-muted transition-colors"
          :class="[sizes.gap, sizes.text]"
          @click="onTap($event, item.category)"
        >
          <span
            class="relative grid place-items-center overflow-hidden rounded-full transition-[height,width,transform] duration-150 group-hover:-translate-y-0.5 group-active:scale-90 motion-reduce:transition-[height,width]"
            :class="[categoryText[item.category], categoryBg[item.category], sizes.wrapper]"
          >
            <CategoryIcon
              :category="item.category"
              class="transition-[height,width,transform] duration-150 group-hover:-rotate-[8deg] group-active:-rotate-[8deg] motion-reduce:transition-[height,width] motion-reduce:group-hover:rotate-0 motion-reduce:group-active:rotate-0"
              :class="sizes.icon"
            />
          </span>
          {{ item.label }}
        </button>
      </nav>
    </div>
  </Teleport>
</template>

<style>
/* Not scoped: the ripple <span> is appended straight into the DOM via
   plain JS (onTap above), so it never gets this component's scoped
   data-v-* attribute the way template-authored elements do. */
.action-ripple {
  position: absolute;
  border-radius: 999px;
  background: rgb(255 255 255 / 0.45);
  transform: scale(0);
  pointer-events: none;
  animation: action-ripple-out 0.5s ease-out forwards;
}

@keyframes action-ripple-out {
  to {
    transform: scale(1);
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .action-ripple {
    animation: none;
    display: none;
  }
}
</style>
