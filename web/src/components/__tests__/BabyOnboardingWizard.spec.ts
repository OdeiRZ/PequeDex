import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import BabyOnboardingWizard from '@/components/BabyOnboardingWizard.vue'
import WheelColumn from '@/components/WheelColumn.vue'
import { i18n } from '@/i18n'
import { apiClient } from '@/lib/api'

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>()
  return {
    ...actual,
    apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
  }
})

// jsdom doesn't implement Element.scrollTo - WheelColumn (mounted for the
// due-date step) calls it on mount, same gap as WheelColumn.spec.ts.
if (!Element.prototype.scrollTo) {
  Element.prototype.scrollTo = function (options?: ScrollToOptions | number) {
    if (typeof options === 'object' && options !== null && options.top !== undefined) {
      this.scrollTop = options.top
    }
  }
}

const baby = {
  id: 1,
  name: 'Peque',
  due_date: null,
  birth_date: null,
  sex: null,
  invite_code: 'ABCD1234',
  water_broke_at: null,
}

const wrappers: VueWrapper[] = []

function mountWizard() {
  const wrapper = mount(BabyOnboardingWizard, {
    props: { dateLocale: 'es-ES' },
    global: { plugins: [i18n] },
  })
  wrappers.push(wrapper)
  return wrapper
}

// Buttons here have no stable id/class of their own beyond ".btn-primary"
// or ".tap-card" (shared across steps/options) - matching by their
// visible text is what actually distinguishes "Siguiente" from "Saltar"
// from "No tengo fecha prevista" etc., and reads closer to how someone
// tapping through the wizard would find them.
function buttonWithText(wrapper: VueWrapper, text: string) {
  const match = wrapper.findAll('button').find((btn) => btn.text().includes(text))
  if (!match) throw new Error(`No button with text "${text}"`)
  return match
}

// Lets the mocked apiClient.post promise (and the store's/component's own
// awaits on it) resolve/reject before assertions run.
function flushMicrotasks() {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

describe('BabyOnboardingWizard', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    i18n.global.locale.value = 'es'
    vi.mocked(apiClient.post).mockReset()
  })

  afterEach(() => {
    wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  })

  it('starts on the name step', () => {
    const wrapper = mountWizard()

    expect(wrapper.text()).toContain('¿Cómo se llama tu bebé?')
  })

  it('advances name -> due date -> sex on "Siguiente"', async () => {
    const wrapper = mountWizard()

    await buttonWithText(wrapper, 'Siguiente').trigger('click')
    expect(wrapper.text()).toContain('¿Para cuándo lo esperas?')

    await buttonWithText(wrapper, 'No tengo fecha prevista').trigger('click')
    expect(wrapper.text()).toContain('¿Ya sabéis el sexo?')
  })

  it('going back returns to the previous step', async () => {
    const wrapper = mountWizard()

    await buttonWithText(wrapper, 'Siguiente').trigger('click')
    expect(wrapper.text()).toContain('¿Para cuándo lo esperas?')

    await wrapper.get('button[aria-label="Volver"]').trigger('click')
    expect(wrapper.text()).toContain('¿Cómo se llama tu bebé?')
  })

  it('"Saltar" jumps straight to confirmation from any step', async () => {
    const wrapper = mountWizard()

    await buttonWithText(wrapper, 'Saltar').trigger('click')

    expect(wrapper.text()).toContain('¡Todo listo!')
  })

  it('lets you pick a sex and submits it on creation', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { data: { ...baby, sex: 'nino' } } })
    const wrapper = mountWizard()

    await wrapper.get('input').setValue('Marta')
    await buttonWithText(wrapper, 'Siguiente').trigger('click') // name -> due date
    await buttonWithText(wrapper, 'No tengo fecha prevista').trigger('click') // -> sex

    const sexButtons = wrapper.findAll('button.tap-card')
    await sexButtons[0]!.trigger('click') // "Niño"
    await buttonWithText(wrapper, 'Siguiente').trigger('click') // sex -> confirmation

    await buttonWithText(wrapper, 'Empezar').trigger('click')
    await flushMicrotasks()

    expect(apiClient.post).toHaveBeenCalledWith('/babies', {
      name: 'Marta',
      due_date: undefined,
      sex: 'nino',
    })
    expect(wrapper.emitted('created')).toHaveLength(1)
  })

  it('clamps a due date to the last real day of the month', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { data: baby } })
    const wrapper = mountWizard()

    await buttonWithText(wrapper, 'Siguiente').trigger('click') // name -> due date

    // findAllComponents can't express WheelColumn's own generic
    // (<T extends string | number>) from the outside - each found wrapper
    // is a real VueWrapper around a WheelColumn instance either way, this
    // just re-asserts that past vue-test-utils' own typing gap here.
    const wheels = wrapper.findAllComponents(WheelColumn) as unknown as VueWrapper[]
    const [dayWheel, monthWheel, yearWheel] = wheels
    await dayWheel!.vm.$emit('update:modelValue', 31)
    await monthWheel!.vm.$emit('update:modelValue', 1) // February (0-indexed)
    await yearWheel!.vm.$emit('update:modelValue', 2026) // not a leap year

    await buttonWithText(wrapper, 'Siguiente').trigger('click') // confirms the date -> sex
    await buttonWithText(wrapper, 'Siguiente').trigger('click') // sex -> confirmation
    await buttonWithText(wrapper, 'Empezar').trigger('click')
    await flushMicrotasks()

    expect(apiClient.post).toHaveBeenCalledWith(
      '/babies',
      expect.objectContaining({ due_date: '2026-02-28' }),
    )
  })

  it('shows an error and lets you retry without losing what you entered', async () => {
    vi.mocked(apiClient.post).mockRejectedValueOnce(new Error('network error'))
    const wrapper = mountWizard()

    await wrapper.get('input').setValue('Marta')
    await buttonWithText(wrapper, 'Saltar').trigger('click') // -> confirmation

    await buttonWithText(wrapper, 'Empezar').trigger('click') // fails
    await flushMicrotasks()

    expect(wrapper.text()).toContain('No se ha podido guardar')

    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: { data: baby } })
    await buttonWithText(wrapper, 'Empezar').trigger('click') // retry
    await flushMicrotasks()

    expect(apiClient.post).toHaveBeenLastCalledWith(
      '/babies',
      expect.objectContaining({ name: 'Marta' }),
    )
    expect(wrapper.emitted('created')).toHaveLength(1)
  })

  it('reset() puts a reused instance back to the first step with blank fields', async () => {
    const wrapper = mountWizard()

    await wrapper.get('input').setValue('Marta')
    await buttonWithText(wrapper, 'Saltar').trigger('click') // -> confirmation
    expect(wrapper.text()).toContain('¡Todo listo!')

    wrapper.vm.reset()
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('¿Cómo se llama tu bebé?')
    expect((wrapper.get('input').element as HTMLInputElement).value).toBe('')
  })
})
