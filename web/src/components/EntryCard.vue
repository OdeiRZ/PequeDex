<script setup lang="ts">
import CategoryIcon from './CategoryIcon.vue'
import { categoryText, categoryBg, categoryRing, type Category } from '@/lib/category'

withDefaults(
  defineProps<{
    category: Category
    title: string
    meta: string
    description?: string | null
    badge?: string | null
    /** A small color dot next to the title - a diaper entry's noted
     * residue color, say (see `lib/diaperResidueColor.ts`). Undefined
     * renders nothing, same as every other optional prop here. */
    swatchColor?: string | null
    /** A small milk-drop icon next to the title, filled with this
     * color - a breastfeed's noted milk type, say (see
     * `lib/milkType.ts`). Undefined renders nothing. A droplet, not
     * `swatchColor`'s plain dot, because it's illustrating a liquid,
     * not a flat color swatch. */
    dropletColor?: string | null
    photoSrc?: string | null
    photoAlt?: string
    /** False for a row that isn't a real, editable entity behind it -
     * a prediction, say. Same layout, but no hover lift/press feedback
     * and no `open` click, so it doesn't invite a tap that does
     * nothing. */
    interactive?: boolean
    /** A soft, slow glow around the card - a predicted time that's
     * already arrived, say. Independent of `interactive`: a card can
     * be both non-interactive and pulsing at once. */
    pulsing?: boolean
  }>(),
  { interactive: true, pulsing: false },
)

defineEmits<{ open: [] }>()
</script>

<template>
  <li
    class="flex items-center gap-3 rounded-2xl p-3 shadow-sm ring-1 ring-transparent"
    :class="[
      categoryBg[category],
      interactive && ['card-interactive', categoryRing[category]],
      pulsing && 'entry-card-pulsing',
    ]"
  >
    <component
      :is="interactive ? 'button' : 'div'"
      :type="interactive ? 'button' : undefined"
      class="flex min-w-0 flex-1 items-center gap-3 text-left"
      :class="interactive && 'group'"
      @click="interactive && $emit('open')"
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
        <div class="flex min-w-0 items-center gap-1.5 text-sm font-semibold">
          <span class="truncate">{{ title }}</span>
          <span
            v-if="swatchColor"
            class="h-2 w-2 shrink-0 rounded-full"
            :style="{ backgroundColor: swatchColor }"
            aria-hidden="true"
          ></span>
          <svg
            v-if="dropletColor"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="1.5"
            class="h-3 w-3 shrink-0 text-text-muted"
            :style="{ fill: dropletColor }"
            aria-hidden="true"
          >
            <path d="M12 2s7 8.5 7 13a7 7 0 0 1-14 0c0-4.5 7-13 7-13Z" />
          </svg>
        </div>
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
    </component>

    <slot name="actions" />
  </li>
</template>

<style scoped>
.entry-card-pulsing {
  animation: entry-card-glow 2s ease-in-out infinite;
}

@keyframes entry-card-glow {
  0%,
  100% {
    box-shadow: 0 0 0 0 rgb(255 255 255 / 0.4);
  }
  50% {
    box-shadow: 0 0 0 6px rgb(255 255 255 / 0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .entry-card-pulsing {
    animation: none;
  }
}
</style>
