import { describe, expect, it } from 'vitest'
import {
  ConnectionCredentials,
  ConnectionInput,
  CreateWorkspaceRequest,
  ListWorkspacesQuery,
} from './admin'

describe('CreateWorkspaceRequest', () => {
  it('applies defaults', () => {
    expect(CreateWorkspaceRequest.parse({ name: 'Staging' })).toEqual({
      name: 'Staging',
      ephemeral: false,
      retention: 604_800,
      connections: [],
    })
  })

  it('converts the retention duration', () => {
    expect(CreateWorkspaceRequest.parse({ name: 'CI', retention: '1h' }).retention).toBe(3_600)
  })

  it('accepts idleTtlSeconds only for ephemeral workspaces', () => {
    const ok = CreateWorkspaceRequest.safeParse({
      name: 'CI',
      ephemeral: true,
      idleTtlSeconds: 600,
    })
    expect(ok.success).toBe(true)
    const ko = CreateWorkspaceRequest.safeParse({ name: 'CI', idleTtlSeconds: 600 })
    expect(ko.error?.issues[0]).toMatchObject({
      path: ['idleTtlSeconds'],
      params: { code: 'idle_ttl_requires_ephemeral' },
    })
  })

  it('bounds idleTtlSeconds', () => {
    const parse = (idleTtlSeconds: number) =>
      CreateWorkspaceRequest.safeParse({ name: 'CI', ephemeral: true, idleTtlSeconds }).success
    expect(parse(59)).toBe(false)
    expect(parse(30 * 86_400 + 1)).toBe(false)
  })

  it('caps connections at 20', () => {
    const connections = Array.from({ length: 21 }, () => ({ kind: 'resend', name: 'R' }))
    expect(CreateWorkspaceRequest.safeParse({ name: 'W', connections }).success).toBe(false)
  })
})

describe('ConnectionInput', () => {
  it('keeps the simulation patch sparse', () => {
    expect(
      ConnectionInput.parse({ kind: 'brevo', name: 'B', simulation: { openRate: 5 } }),
    ).toEqual({ kind: 'brevo', name: 'B', simulation: { openRate: 5 } })
  })
  it('accepts smtpUsername for smtp only', () => {
    const smtp = ConnectionInput.parse({ kind: 'smtp', name: 'S', smtpUsername: 'ci.user' })
    expect(smtp).toMatchObject({ smtpUsername: 'ci.user' })
    const resend = ConnectionInput.parse({ kind: 'resend', name: 'R', smtpUsername: 'x' })
    expect(resend).not.toHaveProperty('smtpUsername')
  })
  it('rejects an unknown kind and a bad username', () => {
    expect(ConnectionInput.safeParse({ kind: 'ses', name: 'X' }).success).toBe(false)
    expect(
      ConnectionInput.safeParse({ kind: 'smtp', name: 'S', smtpUsername: 'a b' }).success,
    ).toBe(false)
  })
})

describe('ConnectionCredentials', () => {
  it('requires msk_ keys for API kinds', () => {
    const creds = { kind: 'resend', apiKey: `msk_${'a'.repeat(24)}`, baseUrl: 'http://x' }
    expect(ConnectionCredentials.safeParse(creds).success).toBe(true)
    expect(ConnectionCredentials.safeParse({ ...creds, apiKey: 're_123' }).success).toBe(false)
  })
})

describe('ListWorkspacesQuery', () => {
  it('coerces query strings', () => {
    expect(ListWorkspacesQuery.parse({ includeEphemeral: 'true', limit: '10' })).toEqual({
      includeEphemeral: true,
      limit: 10,
    })
    expect(ListWorkspacesQuery.parse({})).toEqual({ includeEphemeral: false, limit: 50 })
  })
  it('bounds the limit', () => {
    expect(ListWorkspacesQuery.safeParse({ limit: '201' }).success).toBe(false)
  })
  it('takes a workspace id as cursor', () => {
    const cursor = 'ws_01a2057c-d67b-7003-bb51-5bd9e7ed4522'
    expect(ListWorkspacesQuery.parse({ cursor }).cursor).toBe(cursor)
    expect(ListWorkspacesQuery.safeParse({ cursor: 'staging' }).success).toBe(false)
  })
})
