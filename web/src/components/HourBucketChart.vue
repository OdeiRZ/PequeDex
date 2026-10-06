<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { HourBucketStat } from '@/lib/stats'
import { categorySolidBg, type Category } from '@/lib/category'

const props = defineProps<{
  buckets: HourBucketStat[]
  category: Category
  /** e.g. "12 min" or "3" - the chart doesn't know if a bucket's value
   * is minutes, a count, or something else. */
  formatValue: (value: number) => string
}>()

const { t } = useI18n()

// Same "grow in from the floor" trick as WeeklySleep.vue's own bars -
// animating on mount reads as the chart drawing itself in, not just
// appearing already-finished.
const grown = ref(false)
onMounted(() => {
  requestAnimationFrame(() => {
    grown.value = true
  })
})

const hasData = computed(() => props.buckets.some((b) => b.value > 0))
const scaleMax = computed(() => Math.max(1, ...props.buckets.map((b) => b.value)))

function barHeightPercent(value: number): number {
  return value > 0 ? Math.max(4, (value / scaleMax.value) * 100) : 0
}
</script>

<template>
  <template v-if="hasData">
    <div class="flex h-20 items-end justify-between gap-2">
      <div
        v-for="(bucket, index) in buckets"
        :key="bucket.key"
        class="group flex h-full flex-1 flex-col items-center justify-end gap-1"
      >
        <span class="text-[0.6rem] tabular-nums text-text-muted">
          {{ bucket.value > 0 ? formatValue(bucket.value) : '' }}
        </span>
        <div class="flex w-full flex-1 items-end">
          <div
            class="bucket-bar-grow w-full origin-bottom rounded-md"
            :class="categorySolidBg[category]"
            :style="{
              height: `${grown ? barHeightPercent(bucket.value) : 0}%`,
              transitionDelay: `${index * 70}ms`,
            }"
          ></div>
        </div>
        <span class="text-[0.62rem] text-text-muted">
          {{ t(`stats.hourBucket.${bucket.key}`) }}
        </span>
      </div>
    </div>
  </template>
  <p v-else class="py-2 text-center text-sm text-text-muted">{{ t('stats.noDataYet') }}</p>
</template>

<style scoped>
.bucket-bar-grow {
  transition: height 0.55s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@media (prefers-reduced-motion: reduce) {
  .bucket-bar-grow {
    transition: none;
  }
}
</style>
