<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { HeatmapCell } from '@/lib/stats'

const props = defineProps<{
  cells: HeatmapCell[]
  dateLocale?: string
}>()

const { t } = useI18n()

const hasData = computed(() => props.cells.some((c) => c.count > 0))
const maxCount = computed(() => Math.max(1, ...props.cells.map((c) => c.count)))

// 2024-01-01 es un lunes real (no una fecha cualquiera) - se usa solo
// como ancla para sacar el nombre corto del día vía Intl, nunca se
// muestra el año ni se interpreta como una fecha real.
function dayLabel(dayOfWeek: number): string {
  const date = new Date(2024, 0, 1 + dayOfWeek)
  return date.toLocaleDateString(props.dateLocale, { weekday: 'narrow' })
}

function cellsForDay(dayOfWeek: number): HeatmapCell[] {
  return props.cells
    .filter((c) => c.dayOfWeek === dayOfWeek)
    .slice()
    .sort((a, b) => a.hour - b.hour)
}

// 0.12 de opacidad mínima para que una celda con actividad real, pero
// muy por debajo del máximo, siga siendo visible - a opacidad 0
// sería indistinguible de una celda realmente vacía.
function cellOpacity(count: number): number {
  return count === 0 ? 0 : 0.12 + (count / maxCount.value) * 0.88
}

const selected = ref<HeatmapCell | null>(null)

function toggleCell(cell: HeatmapCell): void {
  selected.value =
    selected.value?.dayOfWeek === cell.dayOfWeek && selected.value.hour === cell.hour ? null : cell
}

const selectedLabel = computed(() => {
  if (!selected.value) return null
  const day = new Date(2024, 0, 1 + selected.value.dayOfWeek).toLocaleDateString(props.dateLocale, {
    weekday: 'long',
  })
  const hour = String(selected.value.hour).padStart(2, '0')
  return t('stats.heatmap.cellLabel', { day, hour, count: selected.value.count })
})
</script>

<template>
  <div v-if="hasData">
    <div class="flex gap-1">
      <div class="flex w-4 shrink-0 flex-col gap-[3px]">
        <span
          v-for="dayOfWeek in 7"
          :key="dayOfWeek"
          class="flex h-3.5 items-center text-[0.55rem] text-text-muted"
        >
          {{ dayLabel(dayOfWeek - 1) }}
        </span>
      </div>
      <div class="min-w-0 flex-1 overflow-x-auto">
        <div class="flex w-max flex-col gap-[3px]">
          <div v-for="dayOfWeek in 7" :key="dayOfWeek" class="flex gap-[3px]">
            <button
              v-for="cell in cellsForDay(dayOfWeek - 1)"
              :key="cell.hour"
              type="button"
              class="heatmap-cell h-3.5 w-3.5 shrink-0 rounded-sm bg-feed transition-transform"
              :class="{
                'heatmap-cell-selected':
                  selected?.dayOfWeek === cell.dayOfWeek && selected.hour === cell.hour,
              }"
              :style="{ opacity: cellOpacity(cell.count) }"
              :aria-label="`${cell.hour}:00 · ${cell.count}`"
              @click="toggleCell(cell)"
            />
          </div>
        </div>
        <div class="mt-1 flex w-max justify-between pr-0.5 text-[0.55rem] text-text-muted">
          <span v-for="hour in [0, 6, 12, 18]" :key="hour">{{ hour }}h</span>
        </div>
      </div>
    </div>
    <p class="mt-2 min-h-[1rem] text-center text-xs text-text-muted">
      {{ selectedLabel ?? t('stats.heatmap.hint') }}
    </p>
  </div>
  <p v-else class="py-2 text-center text-sm text-text-muted">{{ t('stats.noDataYet') }}</p>
</template>

<style scoped>
.heatmap-cell-selected {
  outline: 2px solid var(--color-feed);
  outline-offset: 1px;
  transform: scale(1.15);
}
</style>
