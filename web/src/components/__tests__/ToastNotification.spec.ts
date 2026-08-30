import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ToastNotification from '@/components/ToastNotification.vue'
import { useToastStore } from '@/stores/toast'

function mountToast() {
  setActivePinia(createPinia())

  return { wrapper: mount(ToastNotification), toast: useToastStore() }
}

describe('ToastNotification', () => {
  it('renders nothing when there is no message', () => {
    const { wrapper } = mountToast()

    expect(wrapper.find('[role="status"]').exists()).toBe(false)
  })

  it('shows the current toast message from the store', async () => {
    const { wrapper, toast } = mountToast()

    toast.show('Guardado.')
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[role="status"]').text()).toBe('Guardado.')
  })
})
