<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useI18n } from 'vue-i18n'
import SegmentedControl from '@/components/SegmentedControl.vue'
import SoundCategoryIcon from '@/components/SoundCategoryIcon.vue'
import { SOUND_CATEGORIES, soundBg, soundText, type SoundCategory } from '@/lib/soundCategory'
import { useSoundPlayer, type DurationOption } from '@/composables/useSoundPlayer'

const { t } = useI18n()

const {
  playing,
  category,
  durationOption,
  remainingSeconds,
  unavailable,
  fadingOut,
  play,
  stop,
  setDuration,
} = useSoundPlayer()

// Local a la vista, no al composable - seleccionar una tarjeta solo
// decide qué se ve en el reproductor, no arranca nada por sí sola.
// Se preselecciona con la última categoría reproducida (si la hay), la
// misma que useSoundPlayer ya recuerda de una sesión anterior.
const selected = ref<SoundCategory | null>(category.value)

const durationOptions: { value: DurationOption; label: string }[] = [
  { value: '15', label: t('sounds.durations.m15') },
  { value: '30', label: t('sounds.durations.m30') },
  { value: '45', label: t('sounds.durations.m45') },
  { value: '60', label: t('sounds.durations.m60') },
  { value: 'unlimited', label: t('sounds.durations.unlimited') },
]

function selectCategory(cat: SoundCategory) {
  if (playing.value) stop()
  selected.value = cat
}

function onToggle() {
  if (!selected.value) return
  if (playing.value && category.value === selected.value) {
    stop()
  } else {
    play(selected.value, durationOption.value)
  }
}

const isPlayingSelected = computed(() => playing.value && category.value === selected.value)
const isSelectedUnavailable = computed(
  () => !!selected.value && unavailable.value.has(selected.value),
)

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, '0')
  const s = Math.floor(totalSeconds % 60)
    .toString()
    .padStart(2, '0')
  return `${m}:${s}`
}

const statusText = computed(() => {
  if (!isPlayingSelected.value) return t('sounds.play')
  if (durationOption.value === 'unlimited') return t('sounds.playing')
  if (fadingOut.value) return t('sounds.fadingOut')
  return t('sounds.remaining', { time: formatTime(remainingSeconds.value) })
})
</script>

<template>
  <main class="flex flex-1 flex-col gap-5 px-4 py-5 pb-28">
    <div class="flex items-center justify-between">
      <RouterLink
        :to="{ name: 'dashboard' }"
        class="grid h-9 w-9 shrink-0 place-items-center rounded-full text-text-muted transition-colors hover:text-text active:text-text"
        :aria-label="t('common.back')"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="h-5 w-5"
        >
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
      </RouterLink>
      <h1 class="font-display text-lg font-bold">{{ t('sounds.title') }}</h1>
      <span class="h-9 w-9 shrink-0"></span>
    </div>

    <div class="grid grid-cols-2 gap-3">
      <button
        v-for="cat in SOUND_CATEGORIES"
        :key="cat.id"
        type="button"
        class="flex flex-col items-center gap-2 rounded-2xl border p-4 transition-colors"
        :class="
          selected === cat.id
            ? 'border-brand-teal bg-brand-teal/8'
            : 'border-border bg-surface hover:border-brand-teal/50'
        "
        @click="selectCategory(cat.id)"
      >
        <span
          class="grid h-12 w-12 place-items-center rounded-full"
          :class="[soundBg[cat.id], soundText[cat.id]]"
        >
          <SoundCategoryIcon :category="cat.id" class="h-6 w-6" />
        </span>
        <span class="text-sm font-semibold">{{ t(cat.labelKey) }}</span>
        <span v-if="unavailable.has(cat.id)" class="text-[0.65rem] text-text-muted">
          {{ t('sounds.unavailable') }}
        </span>
      </button>
    </div>

    <div v-if="selected" class="rounded-2xl border border-border bg-surface p-5 text-center">
      <SegmentedControl
        :model-value="durationOption"
        :options="durationOptions"
        class="mb-5"
        @update:model-value="setDuration"
      />

      <div class="relative mx-auto mb-4 grid h-28 w-28 place-items-center">
        <span class="timer-ring" :class="{ 'is-running': isPlayingSelected && !fadingOut }"></span>
        <span
          class="grid h-20 w-20 place-items-center rounded-full"
          :class="[soundBg[selected], soundText[selected]]"
        >
          <SoundCategoryIcon :category="selected" class="h-9 w-9" />
        </span>
      </div>

      <p class="mb-4 text-sm text-text-muted">
        {{ isSelectedUnavailable ? t('sounds.unavailableHint') : statusText }}
      </p>

      <button
        type="button"
        class="mx-auto grid h-16 w-16 place-items-center rounded-full bg-brand-teal text-brand-ink shadow-md transition-transform active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
        :disabled="isSelectedUnavailable"
        :aria-label="isPlayingSelected ? t('sounds.stop') : t('sounds.play')"
        @click="onToggle"
      >
        <svg v-if="!isPlayingSelected" viewBox="0 0 24 24" fill="currentColor" class="h-7 w-7">
          <path d="M8 5v14l11-7z" />
        </svg>
        <svg v-else viewBox="0 0 24 24" fill="currentColor" class="h-7 w-7">
          <path d="M6 5h4v14H6zM14 5h4v14h-4z" />
        </svg>
      </button>
    </div>
  </main>
</template>

<style scoped>
/* Mismo lenguaje visual que el aro de ContractionsView.vue (no se
   puede reutilizar entre componentes al ser CSS con scope), pero
   respirando de forma continua mientras suena en vez de solo una
   pulsación - aquí no hay un evento puntual que marcar, solo "sigue
   sonando". */
.timer-ring {
  position: absolute;
  inset: -4px;
  border-radius: 999px;
  border: 2px solid var(--brand-teal);
  opacity: 0;
  pointer-events: none;
}

.timer-ring.is-running {
  opacity: 1;
  animation: sounds-ring-breathe 2.4s ease-in-out infinite;
}

@keyframes sounds-ring-breathe {
  0%,
  100% {
    transform: scale(0.94);
    opacity: 0.35;
  }
  50% {
    transform: scale(1.08);
    opacity: 0.9;
  }
}

@media (prefers-reduced-motion: reduce) {
  .timer-ring.is-running {
    animation: none;
    opacity: 0.6;
  }
}
</style>
