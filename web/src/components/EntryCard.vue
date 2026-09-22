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
