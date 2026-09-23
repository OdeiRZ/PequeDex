<script setup lang="ts">
import { computed, ref, useSlots } from 'vue'
import CategoryIcon from './CategoryIcon.vue'
import { categoryText, categoryBg, categoryRing, type Category } from '@/lib/category'

const props = withDefaults(
  defineProps<{
    category: Category
    title: string
    meta: string
    description?: string | null
    badge?: string | null
    /** A small droplet icon next to the title, filled with this color -
     * a breastfeed's milk type (`lib/milkType.ts`) or a wet/both diaper
     * change's fixed pee yellow (`lib/diaperResidueColor.ts`'s
     * `DIAPER_PEE_COLOR`). Undefined renders nothing. */
    dropletColor?: string | null
    /** A small poop-swirl icon next to the title, filled with this
     * color - a dirty/both diaper change's noted residue color, or the
     * generic brown default when none was noted (see
     * `lib/diaperResidueColor.ts`). Undefined renders nothing. Can
     * appear alongside `dropletColor` at once (a "both" diaper change
     * has pee and poop both). */
    poopColor?: string | null
    /** A small emoji next to the title - 💤 for a sleep entry (see
     * `entrySleepEmoji()` in `DashboardView.vue`). Emoji, not an SVG
     * icon, same "matches this app's existing convention, no new
     * assets" reasoning as `lib/milestoneCategory.ts`'s own emoji map.
     * Undefined renders nothing. */
    emoji?: string | null
    /** Gently breathes the emoji above instead of leaving it static -
     * an ongoing sleep (no `ended_at` yet), so "still asleep right
     * now" reads differently at a glance from "was asleep, already
     * woke up". */
    emojiPulsing?: boolean
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
    /** Opt-in per `auth.user.swipe_to_delete_enabled` (Perfil > Ajustes) -
     * false is the always-visible trash icon everyone already knows,
     * unchanged. True moves whatever was passed into `#actions` behind
     * a left-swipe instead, for whoever explicitly turned this on. Has
     * no effect without both `interactive` and real `#actions` content
     * (a prediction row has neither an open action nor a delete one). */
    swipeToDelete?: boolean
  }>(),
  { interactive: true, pulsing: false, emojiPulsing: false, swipeToDelete: false },
)

const emit = defineEmits<{ open: [] }>()

const slots = useSlots()

const swipeMode = computed(() => props.swipeToDelete && props.interactive && !!slots.actions)

// Reveals the actions drawer sitting underneath (not an instant delete
// on swipe - the drawer still requires an explicit tap on the real
// button inside it, same as iOS Mail's own swipe-to-reveal, so a stray
// drag never deletes anything by itself). REVEAL_PX matches the
// drawer's own width (DeleteButton at h-7/w-7 plus its padding).
const REVEAL_PX = 64
const RESISTANCE_START_PX = 56

const dragX = ref(0)
const dragging = ref(false)
const revealed = ref(false)
let dragStartX = 0
let dragStartY = 0
let axisLocked: 'x' | 'y' | null = null

function resistedDrag(rawDx: number): number {
  // Only resist past the reveal point - dragging back toward 0 (closing)
  // should always track 1:1, or closing would feel sticky right when
  // the user is trying to dismiss it.
  const magnitude = Math.abs(rawDx)
  if (magnitude <= RESISTANCE_START_PX) return rawDx

  const over = magnitude - RESISTANCE_START_PX
  const resistedMagnitude = RESISTANCE_START_PX + over * 0.35
  return rawDx < 0 ? -resistedMagnitude : resistedMagnitude
}

function onRowPointerDown(event: PointerEvent) {
  if (!swipeMode.value) return

  dragging.value = true
  axisLocked = null
  dragStartX = event.clientX
  dragStartY = event.clientY
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
}

function onRowPointerMove(event: PointerEvent) {
  if (!dragging.value) return

  const dx = event.clientX - dragStartX
  const dy = event.clientY - dragStartY

  if (axisLocked === null && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) {
    axisLocked = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
  }
  if (axisLocked !== 'x') return

  const base = revealed.value ? -REVEAL_PX : 0
  dragX.value = Math.min(0, resistedDrag(base + dx))
}

function onRowPointerUp() {
  if (!dragging.value) return

  dragging.value = false

  if (axisLocked === 'x') {
    revealed.value = dragX.value < -REVEAL_PX / 2
  }
  dragX.value = revealed.value ? -REVEAL_PX : 0
  axisLocked = null
}

function onRowClick() {
  if (revealed.value) {
    revealed.value = false
    dragX.value = 0
    return
  }

  emit('open')
}
</script>

<template>
  <li
    class="relative rounded-2xl shadow-sm ring-1 ring-transparent"
    :class="[
      swipeMode && 'overflow-hidden',
      interactive && ['card-interactive', categoryRing[category]],
      pulsing && 'entry-card-pulsing',
    ]"
  >
    <!-- Swipe mode only: the real #actions content sits here, revealed
         from under the row as it slides left - same slot content the
         non-swipe layout renders inline below, just repositioned. -->
    <div
      v-if="swipeMode"
      class="absolute inset-y-0 right-0 flex items-center justify-end rounded-2xl pr-3"
      :style="{ width: `${REVEAL_PX}px` }"
    >
      <slot name="actions" />
    </div>

    <div
      class="flex items-center gap-3 rounded-2xl p-3"
      :class="[
        categoryBg[category],
        swipeMode && 'relative',
        swipeMode && !dragging && 'transition-transform duration-200 ease-out',
      ]"
      :style="swipeMode ? { transform: `translateX(${dragX}px)`, touchAction: 'pan-y' } : undefined"
      @pointerdown="onRowPointerDown"
      @pointermove="onRowPointerMove"
      @pointerup="onRowPointerUp"
      @pointercancel="onRowPointerUp"
    >
      <component
        :is="interactive ? 'button' : 'div'"
        :type="interactive ? 'button' : undefined"
        class="flex min-w-0 flex-1 items-center gap-3 text-left"
        :class="interactive && 'group'"
        @click="interactive && (swipeMode ? onRowClick() : emit('open'))"
      >
        <img
          v-if="photoSrc"
          :src="photoSrc"
          :alt="photoAlt ?? ''"
          class="h-10 w-10 shrink-0 rounded-lg object-cover transition-transform duration-150 group-hover:scale-110 group-active:scale-110"
        />
        <span
          v-else
          class="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-surface/70 transition-transform duration-150 group-hover:scale-110 group-active:scale-110"
          :class="categoryText[category]"
        >
          <CategoryIcon :category="category" class="h-[1.05rem] w-[1.05rem]" />
        </span>

        <div class="min-w-0 flex-1">
          <div class="flex min-w-0 items-center gap-1.5 text-sm font-semibold">
            <span class="truncate">{{ title }}</span>
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
            <svg
              v-if="poopColor"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="1"
              class="h-3 w-3 shrink-0 text-text-muted"
              :style="{ fill: poopColor }"
              aria-hidden="true"
            >
              <circle cx="12" cy="18" r="5.5" />
              <circle cx="12" cy="13" r="4.3" />
              <circle cx="12" cy="9" r="3.2" />
              <circle cx="12" cy="6" r="2" />
            </svg>
            <span
              v-if="emoji"
              class="shrink-0 text-xs leading-none"
              :class="emojiPulsing && 'entry-emoji-pulsing'"
              aria-hidden="true"
            >
              {{ emoji }}
            </span>
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

      <slot v-if="!swipeMode" name="actions" />
    </div>
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

/* A gentle rise-and-fade, not a hard blink - reads as "still
   happening" without competing for attention with the flash/glow
   animations elsewhere on this same card. */
.entry-emoji-pulsing {
  animation: entry-emoji-breathe 2s ease-in-out infinite;
}

@keyframes entry-emoji-breathe {
  0%,
  100% {
    opacity: 0.5;
    transform: translateY(0);
  }
  50% {
    opacity: 1;
    transform: translateY(-1px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .entry-emoji-pulsing {
    animation: none;
  }
}
</style>
