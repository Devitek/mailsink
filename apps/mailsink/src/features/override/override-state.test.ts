import type { OverrideState, OverrideView } from '@mailsink/contracts'
import { describe, expect, it } from 'vitest'
import { activeScopes, pendingView, withoutScopes, withView } from './override-state'

const view = (connectionId: string | null, id = 'ovr_1'): OverrideView => ({
  id: id as OverrideView['id'],
  connectionId: connectionId as OverrideView['connectionId'],
  config: { rules: [] },
  activatedVia: 'ui',
  expiresAt: null,
  createdAt: '2026-11-23T10:00:00.000Z',
})

const empty: OverrideState = { workspace: null, connections: [], effective: {} }

describe('override state helpers', () => {
  it('lists the active scopes, workspace first', () => {
    const state = { ...empty, workspace: view(null), connections: [view('con_a', 'ovr_2')] }
    expect(activeScopes(state)).toEqual([null, 'con_a'])
    expect(activeScopes(empty)).toEqual([])
  })

  it('puts a view in its scope, replacing the previous one', () => {
    const state = withView({ ...empty, connections: [view('con_a', 'ovr_old')] }, view('con_a'))
    expect(state.connections.map((c) => c.id)).toEqual(['ovr_1'])
    expect(withView(empty, view(null)).workspace?.id).toBe('ovr_1')
  })

  it('removes scopes', () => {
    const state = { ...empty, workspace: view(null), connections: [view('con_a'), view('con_b')] }
    expect(withoutScopes(state, [null, 'con_a'])).toMatchObject({
      workspace: null,
      connections: [{ connectionId: 'con_b' }],
    })
  })

  it('builds the pending view of an activation, with its expiry', () => {
    const now = new Date('2026-11-23T10:00:00.000Z')
    const pending = pendingView({ connectionId: 'con_a', config: { rules: [] }, ttl: 900 }, now)
    expect(pending).toMatchObject({
      connectionId: 'con_a',
      activatedVia: 'ui',
      expiresAt: '2026-11-23T10:15:00.000Z',
      createdAt: '2026-11-23T10:00:00.000Z',
    })
    expect(pendingView({ config: { rules: [] } }, now).expiresAt).toBeNull()
  })
})
