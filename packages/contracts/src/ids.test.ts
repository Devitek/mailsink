import { describe, expect, it } from 'vitest'
import { ConnectionId, keyKind, MessageId, WorkspaceRef } from './ids'

describe('prefixed ids', () => {
  it('accepts the right prefix', () => {
    expect(MessageId.safeParse('msg_0192f3a4-7b1c-7d2e-8f00-1234567890ab').success).toBe(true)
    expect(ConnectionId.safeParse('con_01JD9ZK').success).toBe(true)
  })
  it.each(['con_', 'msg_abc', 'con abc', 'con_a/b', 'CON_abc'])('rejects %j', (id) => {
    expect(ConnectionId.safeParse(id).success).toBe(false)
  })
})

describe('WorkspaceRef', () => {
  it('accepts an id or a slug', () => {
    expect(WorkspaceRef.safeParse('ws_0192f3a4').success).toBe(true)
    expect(WorkspaceRef.safeParse('ci-run-42').success).toBe(true)
    expect(WorkspaceRef.safeParse('Not A Slug').success).toBe(false)
  })
})

describe('keyKind', () => {
  it('tells connection and workspace keys apart', () => {
    expect(keyKind(`msk_live_${'a'.repeat(24)}`)).toBe('connection')
    expect(keyKind(`mskw_${'a'.repeat(24)}`)).toBe('workspace')
    expect(keyKind('re_123')).toBeNull()
    expect(keyKind('msk_short')).toBeNull()
  })
})
