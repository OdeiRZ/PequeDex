<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { categorySolidBg, type Category } from '@/lib/category'

// Genérico a propósito - lo reutiliza StatsView.vue tres veces (sueño/
// tomas/pañales), cada vez con sus propios puntos/color/formateador,
// en vez de tres componentes casi idénticos. Mismo criterio "crece
// desde el suelo al montar" que HourBucketChart.vue/WeeklySleep.vue.
const props = defineProps<{
  points: { label: string; value: number | null }[]
  category: Category
  formatValue: (value: number) => string
}>()

const grown = ref(false)
onMounted(() => {
  requestAnimationFrame(() => {
    grown.value = true
  })
})

const hasData = computed(() => props.points.some((p) => p.value !== null && p.value > 0))
const scaleMax = computed(() => Math.max(1, ...props.points.map((p) => p.value ?? 0)))

function barHeightPercent(value: number | null): number {
  if (value === null || value <= 0) return 0
  return Math.max(4, (value / scaleMax.value) * 100)
}
</script>

<template>
  <template v-if="hasData">
    <!-- Cada barra tiene un ancho mínimo (`min-w-9`) pero crece
         (`flex-1`) para repartirse el hueco sobrante cuando hay pocas
         semanas, en vez de dejarlas apelotonadas a la izquierda. Con
         más semanas de las que caben a ese ancho mínimo, el navegador
         ya no puede encogerlas más y aparece el scroll horizontal -
         a diferencia de las 4 franjas horarias (siempre caben), el
         número de semanas crece con el historial real del bebé y no
         tiene un tope fijo razonable. -->
    <div class="flex h-20 items-end gap-2 overflow-x-auto pb-1">
      <div
        v-for="(point, index) in points"
        :key="point.label + index"
        class="flex h-full w-9 min-w-9 flex-1 flex-col items-center justify-end gap-1"
      >
        <span class="text-[0.6rem] tabular-nums text-text-muted">
          {{ point.value !== null && point.value > 0 ? formatValue(point.value) : '' }}
        </span>
        <div class="flex w-full flex-1 items-end">
          <div
            v-if="point.value !== null"
            class="trend-bar-grow w-full origin-bottom rounded-md"
            :class="categorySolidBg[category]"
            :style="{
              height: `${grown ? barHeightPercent(point.value) : 0}%`,
              transitionDelay: `${index * 40}ms`,
            }"
          ></div>
          <!-- Sin dato esa semana (no `0`) - una marca hueca, no una
               barra invisible indistinguible de un 0 real. -->
          <div v-else class="trend-bar-empty h-1 w-full rounded-full"></div>
        </div>
        <span class="text-[0.6rem] whitespace-nowrap text-text-muted">{{ point.label }}</span>
      </div>
    </div>
  </template>
  <p v-else class="py-2 text-center text-sm text-text-muted">{{ $t('stats.noDataYet') }}</p>
</template>

<style scoped>
.trend-bar-grow {
  transition: height 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.trend-bar-empty {
  background: repeating-linear-gradient(
    45deg,
    var(--color-border),
    var(--color-border) 2px,
    transparent 2px,
    transparent 5px
  );
}

@media (prefers-reduced-motion: reduce) {
  .trend-bar-grow {
    transition: none;
  }
}
</style>
