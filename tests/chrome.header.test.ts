import { describe, expect, it } from 'vitest'

import { buildIdleSubtitle } from '../apps/chrome-extension/src/lib/header.js'

describe('chrome/header', () => {
  it('joins input summary and model label', () => {
    expect(buildIdleSubtitle({ inputSummary: '1.2k words · 12k chars', modelLabel: 'free' })).toBe(
      '1.2k words · 12k chars · free'
    )
  })

  it('falls back to raw model', () => {
    expect(buildIdleSubtitle({ inputSummary: '12k chars', model: 'openrouter/x' })).toBe(
      '12k chars · openrouter/x'
    )
  })

  it('trims and skips empty parts', () => {
    expect(buildIdleSubtitle({ inputSummary: '  ', modelLabel: '  free  ' })).toBe('free')
    expect(buildIdleSubtitle({ inputSummary: null, modelLabel: null, model: null })).toBe('')
  })
})
