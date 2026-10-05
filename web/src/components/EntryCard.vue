<script setup lang="ts">
import { computed, ref, useSlots } from 'vue'
import CategoryIcon from './CategoryIcon.vue'
import { categoryText, categoryBg, categoryRing, type Category } from '@/lib/category'
import { useFeedback } from '@/composables/useFeedback'

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
    /** A small emoji in the badge pill - 💤 for a finished sleep entry
     * (see `entrySleepEmoji()` in `DashboardView.vue`). A sleep still in
     * progress doesn't pass this - that one shows its own 💤 inside the
     * "Finalizar" button instead (`#primaryAction`), not here. Emoji,
     * not an SVG icon, same "matches this app's existing convention, no
     * new assets" reasoning as `lib/milestoneCategory.ts`'s own emoji
     * map. Undefined renders nothing. */
    emoji?: string | null
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
    /** Ancho en px del panel de acciones revelado por el swipe - el
     * valor por defecto (64) encaja justo un `DeleteButton` (h-7/w-7 +
     * padding), el único contenido que lleva `#actions`. Una acción
     * que deba verse siempre (sin requerir swipe) va en `#primaryAction`,
     * no aquí - ver su propio comentario más abajo en la plantilla. */
    revealPx?: number
  }>(),
  { interactive: true, pulsing: false, swipeToDelete: false, revealPx: 64 },
)

const emit = defineEmits<{ open: [] }>()

const slots = useSlots()
const feedback = useFeedback()

const swipeMode = computed(() => props.swipeToDelete && props.interactive && !!slots.actions)

// Second attempt at this, after the first (manual pointermove math)
// shipped with real problems found live: a translucent categoryBg let
// the drawer bleed through even at rest, and the hand-rolled drag felt
// janky next to native scrolling. Native horizontal scroll-snap fixes
// both at the root instead of patching around them: the actions panel
// is genuinely outside the scrollable viewport at scrollLeft 0 (not
// just visually covered), and the browser's own scroll physics
// (momentum, rubber-banding) replace every line of manual resistance/
// axis-lock math that used to live here. Scrolling to the container's
// max scrollLeft (the `revealPx` prop, since the row itself is 100%
// width) reveals exactly that much, no more.
const CLOSE_THRESHOLD_PX = 4

const scrollerRef = ref<HTMLElement | null>(null)

// Preaviso háptico a mitad del gesto de swipe, no al terminarlo - para
// cuando el dedo ya ha revelado lo suficiente del panel de borrar como
// para que soltarlo ahí sea una decisión real, no un roce accidental.
// Solo vibración (warnVibrate(), sin tono): a mitad de un arrastre que
// el usuario aún puede cancelar deslizando hacia atrás, un sonido se
// sentiría fuera de lugar. Un único pulso por revelado - el booleano
// evita que dispare en cada tick de scroll mientras el dedo sigue ahí,
// y se rearma en cuanto el panel vuelve a cerrarse.
const WARN_THRESHOLD_PX = props.revealPx * 0.5
let warned = false

function onScroll() {
  const scroller = scrollerRef.value
  if (!scroller) return

  if (scroller.scrollLeft >= WARN_THRESHOLD_PX) {
    if (!warned) {
      warned = true
      feedback.warnVibrate()
    }
  } else {
    warned = false
  }
}

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
    class="relative overflow-hidden rounded-2xl shadow-sm ring-1 ring-transparent"
    :class="[
      interactive && ['card-interactive', categoryRing[category]],
      pulsing && 'entry-card-pulsing',
    ]"
  >
    <div
      ref="scrollerRef"
      class="flex rounded-2xl"
      :class="swipeMode && 'swipe-scroller'"
      @scroll="swipeMode && onScroll()"
    >
      <!-- El panel visible en reposo: fondo/padding de categoría,
           título+badge+acción primaria, todo junto. En modo swipe es el
           único panel a la vista hasta deslizar (`w-full shrink-0
           snap-start`) - el panel de borrar vive aparte, fuera de este,
           como hermano dentro del scroller. En modo no-swipe ocupa el
           espacio normal del row. -->
      <div
        class="flex min-w-0 items-center gap-3 rounded-2xl p-3"
        :class="[categoryBg[category], swipeMode ? 'w-full shrink-0 snap-start' : 'flex-1']"
      >
        <component
          :is="interactive ? 'button' : 'div'"
          :type="interactive ? 'button' : undefined"
          class="flex min-w-0 flex-1 items-center gap-3 rounded-2xl text-left"
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
            </div>

            <!-- Segunda línea: el estado real de la entrada (duración +
                 icono(s) de tipo - gota de leche/orina, caca, 💤) en el
                 color de la categoría, sin pastilla ni fondo - ya no
                 compite por sitio con la hora, que se traslada a una
                 marca de tiempo pequeña y discreta a la derecha de la
                 fila (como en un chat), junto al icono de borrar. Sin
                 estado que mostrar (crecimiento, hitos, predicciones),
                 la hora se queda aquí tal cual, como siempre. -->
            <div
              v-if="badge || dropletColor || poopColor || emoji"
              class="flex items-center gap-1 text-sm font-bold"
              :class="categoryText[category]"
            >
              <span v-if="badge">{{ badge }}</span>
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
              <span v-if="emoji" class="shrink-0 text-xs leading-none" aria-hidden="true">
                {{ emoji }}
              </span>
            </div>
            <div v-else class="text-sm tabular-nums text-text-muted">{{ meta }}</div>

            <div v-if="description" class="mt-0.5 text-xs text-text-muted">{{ description }}</div>
          </div>

          <span
            v-if="badge || dropletColor || poopColor || emoji"
            class="mr-1.5 shrink-0 text-center text-sm font-bold tabular-nums text-text-muted"
          >
            {{ meta }}
          </span>
        </component>

        <!-- Hermano del `component` de arriba, no contenido dentro de
             él - anidar un `<button>` (p.ej. "Finalizar") dentro de otro
             `<button>` (el propio row) es HTML inválido y el navegador
             lo corta solo, rompiendo el DOM. Al vivir aquí, dentro de
             este mismo panel siempre visible, queda "junto al texto,
             antes del puller" sin ese problema. -->
        <slot name="primaryAction" />

        <!-- The swipe hint sits in this same always-visible panel, not
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

        <!-- Modo no-swipe: el icono de borrar vive aquí, dentro del
             mismo panel con fondo/padding de categoría - fuera de él
             (como hermano suelto del panel en el scroller) perdía ese
             fondo y el centrado vertical que le da `items-center`. En
             modo swipe sigue viviendo aparte, en el panel que se revela
             deslizando (ver más abajo). -->
        <slot v-if="!swipeMode" name="actions" />
      </div>

      <div
        v-if="swipeMode"
        class="flex shrink-0 snap-end items-center justify-end gap-1.5 pr-3"
        :style="{ width: `${revealPx}px` }"
      >
        <slot name="actions" />
      </div>
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
