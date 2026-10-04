import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import DateTimeWheel from '@/components/DateTimeWheel.vue'
import WheelColumn from '@/components/WheelColumn.vue'
import { i18n } from '@/i18n'

// jsdom doesn't implement Element.scrollTo - same gap as WheelColumn.spec.ts,
// whose three instances DateTimeWheel mounts internally.
if (!Element.prototype.scrollTo) {
  Element.prototype.scrollTo = function (options?: ScrollToOptions | number) {
    if (typeof options === 'object' && options !== null && options.top !== undefined) {
      this.scrollTop = options.top
    }
  }
}

const wrappers: VueWrapper[] = []

function mountWheel(modelValue: string, min?: string) {
  const wrapper = mount(DateTimeWheel, {
    props: { modelValue, min, dateLocale: 'es-ES', ariaLabel: 'Ejemplo' },
    global: { plugins: [i18n] },
  })
  wrappers.push(wrapper)
  return wrapper
}

// findAllComponents no puede expresar el propio genérico de WheelColumn
// (<T extends string | number>) desde fuera - cada wrapper encontrado es un
// VueWrapper real alrededor de una instancia de WheelColumn de todas
// formas, esto solo reafirma ese hueco de tipado de vue-test-utils. Mismo
// patrón que ya usa BabyOnboardingWizard.spec.ts para el mismo componente;
// aquí además se leen props (no solo `.vm.$emit(...)`), así que cada
// llamada a `.props()` se castea aparte a la forma concreta que hace falta
// en cada test, en vez de perder el tipado del todo con `any`.
function wheelColumns(wrapper: VueWrapper) {
  return wrapper.findAllComponents(WheelColumn) as unknown as VueWrapper[]
}

interface DayItem {
  value: string
  label: string
}

describe('DateTimeWheel', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    i18n.global.locale.value = 'es'
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-20T12:00:00'))
  })

  afterEach(() => {
    wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
    vi.useRealTimers()
  })

  it('splits modelValue into day/hour/minute wheels', () => {
    const wrapper = mountWheel('2026-09-20T08:05')
    const columns = wheelColumns(wrapper)

    expect(columns).toHaveLength(3)
    expect((columns[0]!.props() as { modelValue: string }).modelValue).toBe('2026-09-20')
    expect((columns[1]!.props() as { modelValue: number }).modelValue).toBe(8)
    expect((columns[2]!.props() as { modelValue: number }).modelValue).toBe(5)
  })

  it('labels today and yesterday, formats the rest with the given locale', () => {
    const wrapper = mountWheel('2026-09-20T08:05')
    const dayItems = (wheelColumns(wrapper)[0]!.props() as { items: DayItem[] }).items
    const last = dayItems.length - 1

    expect(dayItems[last]).toEqual({ value: '2026-09-20', label: 'Hoy' })
    expect(dayItems[last - 1]).toEqual({ value: '2026-09-19', label: 'Ayer' })
    expect(dayItems[last - 2]!.value).toBe('2026-09-18')
    expect(dayItems[last - 2]!.label).not.toBe('')
  })

  it('limits the day range to `min` when given, instead of the 90-day fallback', () => {
    const wrapper = mountWheel('2026-09-20T08:05', '2026-09-17T00:00')
    const dayItems = (wheelColumns(wrapper)[0]!.props() as { items: DayItem[] }).items

    expect(dayItems).toHaveLength(4) // 17, 18, 19, 20 de septiembre
    expect(dayItems[0]!.value).toBe('2026-09-17')
  })

  it('still includes the current value even if it falls outside the normal range', () => {
    // Editando un registro de hace más de 90 días, sin min - no debería
    // recortarse de la lista, o la rueda se quedaría sin fila seleccionada.
    const wrapper = mountWheel('2026-01-01T08:05')
    const dayItems = (wheelColumns(wrapper)[0]!.props() as { items: DayItem[] }).items

    expect(dayItems[0]!.value).toBe('2026-01-01')
  })

  it('emits a combined modelValue when one wheel changes, preserving the others', async () => {
    const wrapper = mountWheel('2026-09-20T08:05')
    const hourColumn = wheelColumns(wrapper)[1]!

    await hourColumn.vm.$emit('update:modelValue', 14)

    expect(wrapper.emitted('update:modelValue')).toEqual([['2026-09-20T14:05']])
  })
})
