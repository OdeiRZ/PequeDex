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

// Second attempt at this, after the first (manual pointermove math)
// shipped with real problems found live: a translucent categoryBg let
// the drawer bleed through even at rest, and the hand-rolled drag felt
// janky next to native scrolling. Native horizontal scroll-snap fixes
// both at the root instead of patching around them: the actions panel
// is genuinely outside the scrollable viewport at scrollLeft 0 (not
// just visually covered), and the browser's own scroll physics
// (momentum, rubber-banding) replace every line of manual resistance/
// axis-lock math that used to live here. REVEAL_PX is the actions
// panel's own width (DeleteButton at h-7/w-7 plus padding) - scrolling
// to the container's max scrollLeft (panel width, since the row itself
// is 100% width) reveals exactly it, no more.
const REVEAL_PX = 64
const CLOSE_THRESHOLD_PX = 4

const scrollerRef = ref<HTMLElement | null>(null)

function onRowClick() {
  const scroller = scrollerRef.value

  // A revealed drawer closes on tapping the row again, same as tapping
  // anywhere outside an opened iOS Mail swipe action - a tap here is
  // clearly "dismiss this", not "open the entry", while it's showing.
  if (scroller && scroller.scrollLeft > CLOSE_THRESHOLD_PX) {
    scroller.scrollTo({ left: 0, behavior: 'smooth' })

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
    <!-- The category-tinted background/padding lives here (not on the
         button below) in the classic layout, since the actions slot sits
         as its sibling and needs to share the same card surface - the
         tira reaching the delete icon, not stopping at the button's own
         edge. In swipe mode it moves onto the button instead: that's the
         only panel visible at rest, and the actions panel behind it
         should read as a plain reveal zone, not another tinted card. -->
    <div
      ref="scrollerRef"
      class="flex rounded-2xl"
      :class="swipeMode ? 'swipe-scroller' : ['items-center gap-3 p-3', categoryBg[category]]"
    >
      <component
        :is="interactive ? 'button' : 'div'"
        :type="interactive ? 'button' : undefined"
        class="flex min-w-0 items-center gap-3 rounded-2xl text-left"
        :class="[
          interactive && 'group',
          swipeMode ? [categoryBg[category], 'w-full shrink-0 snap-start p-3'] : 'flex-1',
        ]"
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

        <!-- The actions panel now sits fully outside the visible viewport
             at rest (real overflow, not just covered by color) - without
             this, nothing on screen hints that there's anything to swipe
             to at all. Lives inside the always-visible first panel, not
             the drawer itself, so it's never scrolled away with it. -->
        <svg
          v-if="swipeMode"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="swipe-hint h-3.5 w-3.5 shrink-0 text-text-muted/50"
          aria-hidden="true"
        >
          <path d="M15 6l-6 6 6 6" />
        </svg>
      </component>

      <div
        v-if="swipeMode"
        class="flex shrink-0 snap-end items-center justify-end pr-3"
        :style="{ width: `${REVEAL_PX}px` }"
      >
        <slot name="actions" />
      </div>
      <slot v-else name="actions" />
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

/* Native horizontal scroll instead of hand-rolled pointermove math -
   the browser's own scroll-snap physics (momentum, rubber-banding)
   replace what used to be manual resistance/axis-lock code, and the
   actions panel is genuinely outside the scrollable viewport at rest
   (not just visually covered), so there's nothing to bleed through.
   Scrollbar hidden - this reads as a swipe gesture, not a text panel
   with a horizontal scrollbar. */
.swipe-scroller {
  overflow-x: auto;
  overflow-y: hidden;
  scroll-snap-type: x mandatory;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.swipe-scroller::-webkit-scrollbar {
  display: none;
}

/* A slow, small nudge left - just enough to read as "this points
   somewhere", not an urgent blinking arrow competing with the rest of
   the row. Runs continuously rather than once-then-stop: there's no
   per-row "already seen this" state to track, and a caregiver who
   hasn't used this entry yet should still see it whenever they look. */
.swipe-hint {
  animation: swipe-hint-nudge 2.2s ease-in-out infinite;
}

@keyframes swipe-hint-nudge {
  0%,
  100% {
    transform: translateX(0);
  }
  50% {
    transform: translateX(-3px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .swipe-hint {
    animation: none;
  }
}
</style>
