import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import UserAvatar from '@/components/UserAvatar.vue'

describe('UserAvatar', () => {
  it('shows the uploaded photo when there is one', () => {
    const wrapper = mount(UserAvatar, {
      props: { name: 'Odei', avatar: 'data:image/png;base64,xyz' },
    })

    const img = wrapper.find('img')
    expect(img.exists()).toBe(true)
    expect(img.attributes('src')).toBe('data:image/png;base64,xyz')
  })

  it('falls back to the first letter of the name when there is no photo', () => {
    const wrapper = mount(UserAvatar, { props: { name: 'Violeta' } })

    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.text()).toBe('V')
  })

  it('falls back to "?" for a blank name', () => {
    const wrapper = mount(UserAvatar, { props: { name: '' } })

    expect(wrapper.text()).toBe('?')
  })
})
