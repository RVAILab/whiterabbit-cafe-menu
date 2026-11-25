import { describe, expect, it } from 'vitest'
import { resolveEffectiveLayout } from './effectiveLayout'

describe('resolveEffectiveLayout', () => {
  it('lets ?layout= override display control, including ?layout=featured', () => {
    expect(resolveEffectiveLayout({ search: '?layout=featured', desiredLayout: 'rabbit-hole' })).toBe('featured')
    expect(resolveEffectiveLayout({ search: '?layout=standard', desiredLayout: 'featured' })).toBe('standard')
  })

  it('uses the display-control layout when the URL names none or an unknown one', () => {
    expect(resolveEffectiveLayout({ search: '', desiredLayout: 'featured' })).toBe('featured')
    expect(resolveEffectiveLayout({ search: '?layout=doors', desiredLayout: 'featured' })).toBe('featured')
    expect(resolveEffectiveLayout({ search: '' })).toBe('standard')
  })
})
