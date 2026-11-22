import { describe, expect, it } from 'vitest'
import { health } from './health'

describe('health', () => {
  it('reports ok with whole seconds of uptime', () => {
    expect(health(12.7)).toEqual({ status: 'ok', uptimeSeconds: 12 })
  })
})
