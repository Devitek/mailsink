import { describe, expect, it } from 'vitest'
import { issueCode } from './common'
import { UpdateConnectionRequest, UpdateWorkspaceRequest } from './workspace-manage'

describe('UpdateWorkspaceRequest', () => {
  it('parses durations and keeps null to clear the rate limit', () => {
    expect(UpdateWorkspaceRequest.parse({ retention: '24h', rateLimit: null })).toEqual({
      retention: 86_400,
      rateLimit: null,
    })
    expect(UpdateWorkspaceRequest.parse({ rateLimit: { limit: 5 } })).toEqual({
      rateLimit: { limit: 5, windowSeconds: 1 },
    })
  })

  it('takes the message quota (null = unbounded) and complete default simulation settings', () => {
    expect(UpdateWorkspaceRequest.parse({ maxMessages: null })).toEqual({ maxMessages: null })
    expect(UpdateWorkspaceRequest.safeParse({ maxMessages: 0 }).success).toBe(false)
    const parsed = UpdateWorkspaceRequest.parse({ simulation: { rates: { hard_bounce: 5 } } })
    expect(parsed.simulation).toEqual({
      rates: { hard_bounce: 5 },
      rules: [],
      latency: { minMs: 0, maxMs: 0 },
      openRate: 0,
      clickRate: 0,
    })
  })

  it('refuses an empty patch and a blank name', () => {
    const empty = UpdateWorkspaceRequest.safeParse({})
    expect(issueCode(empty.error?.issues[0])).toBe('empty_patch')
    expect(UpdateWorkspaceRequest.safeParse({ name: '  ' }).success).toBe(false)
  })
})

describe('UpdateConnectionRequest', () => {
  it('renames or toggles, never nothing', () => {
    expect(UpdateConnectionRequest.parse({ enabled: false })).toEqual({ enabled: false })
    expect(UpdateConnectionRequest.parse({ name: ' Resend ' })).toEqual({ name: 'Resend' })
    expect(UpdateConnectionRequest.safeParse({}).success).toBe(false)
  })
})
