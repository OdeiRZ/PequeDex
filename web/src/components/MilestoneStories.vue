<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { milestoneCategoryEmoji } from '@/lib/milestoneCategory'
import type { Milestone } from '@/stores/babies'

defineProps<{ milestones: Milestone[] }>()
defineEmits<{ open: [id: number]; create: [] }>()

const { t } = useI18n()
</script>

<template>
  <div class="flex gap-3.5 overflow-x-auto px-1 pb-1">
    <!-- No `tag` - renders the buttons as a fragment, so the outer div
    above stays the real flex container (mixed with the always-present "+"
    button right after, which never enters/leaves so it doesn't need a key
    or a spot inside this group). Celebrates a newly logged milestone
    arriving in the row instead of it just appearing already-there, same
    spirit as .badge-pop/.dash-enter elsewhere in the app. -->
    <TransitionGroup name="milestone-pop">
      <button
        v-for="milestone in milestones"
        :key="milestone.id"
        type="button"
        class="flex w-16 shrink-0 flex-col items-center gap-1.5 transition-transform duration-150 hover:-translate-y-0.5 active:scale-95"
        @click="$emit('open', milestone.id)"
      >
        <span
          class="grid h-14 w-14 shrink-0 place-items-center rounded-full p-[2.5px] transition-shadow duration-150 hover:shadow-[0_4px_16px_-4px_var(--milestone)]"
          style="
            background: conic-gradient(
              from 200deg,
              var(--milestone),
              var(--brand),
              var(--sleep),
              var(--milestone)
            );
          "
        >
          <span
            class="grid h-full w-full place-items-center overflow-hidden rounded-full bg-surface"
          >
            <img
              v-if="milestone.photo_url"
              :src="milestone.photo_url"
              :alt="milestone.title"
              class="h-full w-full object-cover"
            />
            <span v-else class="text-xl">{{
              milestoneCategoryEmoji[milestone.category ?? 'otro']
            }}</span>
          </span>
        </span>
        <span class="line-clamp-2 text-center text-[0.62rem] leading-tight text-text-muted">{{
          milestone.title
        }}</span>
      </button>
    </TransitionGroup>

    <button
      type="button"
      class="group flex w-16 shrink-0 flex-col items-center gap-1.5 transition-transform duration-150 hover:-translate-y-0.5 active:scale-95"
      @click="$emit('create')"
    >
      <span
        class="grid h-14 w-14 place-items-center rounded-full border-2 border-dashed border-border bg-surface-sunken text-xl font-bold text-brand transition-[border-color,transform] duration-200 group-hover:scale-110 group-hover:border-brand"
      >
        +
      </span>
      <span class="text-center text-[0.62rem] leading-tight text-text-muted">{{
        t('dashboard.milestones.add')
      }}</span>
    </button>
  </div>
</template>

<style scoped>
.milestone-pop-enter-active {
  animation: milestone-pop-in 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes milestone-pop-in {
  0% {
    opacity: 0;
    transform: scale(0.4) rotate(-8deg);
  }
  60% {
    transform: scale(1.08) rotate(2deg);
  }
  100% {
    opacity: 1;
    transform: scale(1) rotate(0deg);
  }
}

.milestone-pop-move {
  transition: transform 0.3s ease;
}

@media (prefers-reduced-motion: reduce) {
  .milestone-pop-enter-active,
  .milestone-pop-move {
    animation: none;
    transition: none;
  }
}
</style>
