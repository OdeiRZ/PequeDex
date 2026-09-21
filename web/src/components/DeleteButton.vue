<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
defineEmits<{ click: [] }>()
</script>

<template>
  <button
    type="button"
    class="del-btn grid h-7 w-7 shrink-0 place-items-center rounded-lg text-text-muted transition-colors hover:bg-surface-sunken hover:text-danger active:scale-[0.88]"
    :aria-label="t('common.delete')"
    @click="$emit('click')"
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
      <path class="lid" d="M4 7h16M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3" />
      <path d="M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13" />
    </svg>
  </button>
</template>

<style scoped>
/* Hover-only lid tilt - a passive "this is about to open" cue before
   any click happens, rather than only reacting after the fact. The
   hinge sits at the bin's left edge (4, 7 in the 24x24 viewBox), same
   corner the top bar/handle path actually starts from. */
.lid {
  transform-origin: 4px 7px;
  transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.del-btn:hover .lid,
.del-btn:focus-visible .lid {
  transform: rotate(-22deg) translateY(-1px);
}

@media (prefers-reduced-motion: reduce) {
  .lid {
    transition: none;
  }

  .del-btn:hover .lid,
  .del-btn:focus-visible .lid {
    transform: none;
  }
}
</style>
