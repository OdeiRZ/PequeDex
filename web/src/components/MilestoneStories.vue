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
    <button
      v-for="milestone in milestones"
      :key="milestone.id"
      type="button"
      class="flex w-16 shrink-0 flex-col items-center gap-1.5"
      @click="$emit('open', milestone.id)"
    >
      <span
        class="grid h-14 w-14 shrink-0 place-items-center rounded-full p-[2.5px]"
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
        <span class="grid h-full w-full place-items-center overflow-hidden rounded-full bg-surface">
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

    <button
      type="button"
      class="flex w-16 shrink-0 flex-col items-center gap-1.5"
      @click="$emit('create')"
    >
      <span
        class="grid h-14 w-14 place-items-center rounded-full border-2 border-dashed border-border bg-surface-sunken text-xl font-bold text-brand"
      >
        +
      </span>
      <span class="text-center text-[0.62rem] leading-tight text-text-muted">{{
        t('dashboard.milestones.add')
      }}</span>
    </button>
  </div>
</template>
