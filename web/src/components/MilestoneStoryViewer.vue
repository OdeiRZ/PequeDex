<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import UserAvatar from './UserAvatar.vue'
import { lockBodyScroll, unlockBodyScroll } from '@/lib/bodyScrollLock'
import { milestoneCategoryEmoji } from '@/lib/milestoneCategory'
import type { Milestone } from '@/stores/babies'

const props = defineProps<{
  milestone: Milestone
  index: number
  total: number
  isFirst: boolean
  isLast: boolean
  isLiked: boolean
  dateLocale: string
}>()

const emit = defineEmits<{
  close: []
  prev: []
  next: []
  edit: []
  delete: []
  toggleLike: []
}>()

const { t } = useI18n()

// Full-bleed photo without cropping - unlike the small story-ring
// thumbnail (MilestoneStories.vue, which can afford to crop), this is
// the one place someone actually looks closely at the photo itself.
const formattedDate = () =>
  new Date(props.milestone.achieved_at).toLocaleDateString(props.dateLocale)

// Same lock/unlock module BottomSheet uses - this viewer mounts and
// unmounts with the parent's v-if rather than toggling an `open` prop, so
// a plain onMounted/onUnmounted pair is enough (no watcher needed).
onMounted(() => {
  lockBodyScroll()
  window.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  unlockBodyScroll()
  window.removeEventListener('keydown', onKeydown)
})

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'ArrowLeft') emit('prev')
  else if (event.key === 'ArrowRight') emit('next')
  else if (event.key === 'Escape') emit('close')
}

// touchstart/touchend delta, no library - a tap (near-zero delta) falls
// through to the left/right tap zones below instead of triggering a swipe.
const touchStartX = ref<number | null>(null)

function onTouchStart(event: TouchEvent) {
  const touch = event.touches[0]
  if (touch) touchStartX.value = touch.clientX
}

function onTouchEnd(event: TouchEvent) {
  const touch = event.changedTouches[0]
  if (touchStartX.value === null || !touch) return

  const delta = touch.clientX - touchStartX.value
  touchStartX.value = null

  if (Math.abs(delta) < 50) return
  if (delta > 0) emit('prev')
  else emit('next')
}
</script>

<template>
  <Teleport to="body">
    <div
      class="fixed inset-0 z-50 flex flex-col bg-black text-white"
      @touchstart="onTouchStart"
      @touchend="onTouchEnd"
    >
      <div class="relative flex-1 overflow-hidden">
        <img
          v-if="milestone.photo_url"
          :src="milestone.photo_url"
          :alt="milestone.title"
          class="h-full w-full object-contain"
        />
        <div
          v-else
          class="flex h-full w-full items-center justify-center bg-gradient-to-br from-milestone to-milestone/50"
        >
          <span class="text-8xl">{{ milestoneCategoryEmoji[milestone.category ?? 'otro'] }}</span>
        </div>

        <button
          v-if="!isFirst"
          type="button"
          class="absolute inset-y-0 left-0 flex w-1/4 items-center justify-start pl-2 text-white/70"
          :aria-label="t('dashboard.milestones.previous')"
          @click="emit('prev')"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            class="h-8 w-8"
          >
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <button
          v-if="!isLast"
          type="button"
          class="absolute inset-y-0 right-0 flex w-1/4 items-center justify-end pr-2 text-white/70"
          :aria-label="t('dashboard.milestones.next')"
          @click="emit('next')"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            class="h-8 w-8"
          >
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 18l6-6-6-6" />
          </svg>
        </button>

        <div class="absolute inset-x-0 top-0 flex items-center justify-between p-4">
          <span class="rounded-full bg-black/40 px-3 py-1 text-xs font-semibold tabular-nums">
            {{ t('dashboard.milestones.counter', { current: index + 1, total }) }}
          </span>
          <button
            type="button"
            class="grid h-9 w-9 place-items-center rounded-full bg-black/40"
            :aria-label="t('dashboard.milestones.close')"
            @click="emit('close')"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              class="h-5 w-5"
            >
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
      </div>

      <div
        class="flex flex-col gap-3 bg-gradient-to-t from-black to-black/80 p-5"
        style="padding-bottom: calc(1.25rem + env(safe-area-inset-bottom))"
      >
        <div class="flex items-start gap-2">
          <span v-if="milestone.category" class="text-xl leading-none">{{
            milestoneCategoryEmoji[milestone.category]
          }}</span>
          <div class="min-w-0 flex-1">
            <h3 class="font-display text-lg font-bold text-balance">{{ milestone.title }}</h3>
            <p class="text-sm tabular-nums text-white/70">{{ formattedDate() }}</p>
          </div>
          <button
            type="button"
            class="flex shrink-0 flex-col items-center gap-0.5"
            :aria-label="t(isLiked ? 'dashboard.milestones.liked' : 'dashboard.milestones.like')"
            @click="emit('toggleLike')"
          >
            <svg
              viewBox="0 0 24 24"
              :fill="isLiked ? '#ef4444' : 'none'"
              :stroke="isLiked ? '#ef4444' : 'currentColor'"
              stroke-width="2"
              class="h-7 w-7"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M12 20.5s-7-4.5-9.5-9A5.5 5.5 0 0 1 12 6a5.5 5.5 0 0 1 9.5 5.5c-2.5 4.5-9.5 9-9.5 9Z"
              />
            </svg>
          </button>
        </div>

        <p v-if="milestone.description" class="text-sm whitespace-pre-line text-white/90">
          {{ milestone.description }}
        </p>

        <div v-if="milestone.liked_by.length > 0" class="flex items-center gap-2">
          <div class="flex -space-x-2">
            <UserAvatar
              v-for="user in milestone.liked_by"
              :key="user.id"
              :name="user.name"
              :avatar="user.avatar"
              :size="24"
              class="ring-2 ring-black"
            />
          </div>
          <span class="text-xs text-white/70">{{
            milestone.liked_by.map((u) => u.name).join(', ')
          }}</span>
        </div>

        <div class="mt-1 flex gap-3">
          <button type="button" class="btn-primary flex-1" @click="emit('edit')">
            {{ t('common.edit') }}
          </button>
          <button
            type="button"
            class="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/10 text-white/80"
            :aria-label="t('common.delete')"
            @click="emit('delete')"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="h-4 w-4"
            >
              <path
                d="M4 7h16M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
