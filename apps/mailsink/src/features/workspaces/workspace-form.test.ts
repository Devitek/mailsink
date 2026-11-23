import { CreateWorkspaceRequest, UpdateWorkspaceRequest } from '@mailsink/contracts'
import { describe, expect, it } from 'vitest'
import {
  editWorkspaceSchema,
  newWorkspaceDefaults,
  newWorkspaceSchema,
  rateLimitText,
  retentionChoice,
  toCreateRequest,
  toUpdateRequest,
} from './workspace-form'

const m = { nameRequired: 'name', slugInvalid: 'slug', rateInvalid: 'rate' }
const messages = (result: { success: boolean; error?: { issues: { message: string }[] } }) =>
  result.error?.issues.map((i) => i.message) ?? []

describe('new workspace form', () => {
  it('maps the defaults to a persistent workspace without connection', () => {
    const request = toCreateRequest({ ...newWorkspaceDefaults, name: ' QA ' })
    expect(request).toEqual({ name: 'QA', ephemeral: false, retention: 604_800, connections: [] })
    expect(CreateWorkspaceRequest.safeParse(request).success).toBe(true)
  })

  it('maps the slug, the rate limit and the first connection', () => {
    const request = toCreateRequest({
      ...newWorkspaceDefaults,
      name: 'QA',
      slug: 'qa',
      retention: '24h',
      rateLimit: '10',
      withConnection: true,
      kind: 'smtp',
    })
    expect(CreateWorkspaceRequest.parse(request)).toMatchObject({
      slug: 'qa',
      retention: 86_400,
      rateLimit: { limit: 10, windowSeconds: 1 },
      connections: [{ kind: 'smtp', name: 'smtp' }],
    })
  })

  it('reports each invalid field with the given message', () => {
    const schema = newWorkspaceSchema(m)
    const bad = { ...newWorkspaceDefaults, name: ' ', slug: 'Bad slug', rateLimit: '0' }
    expect(messages(schema.safeParse(bad))).toEqual(['name', 'slug', 'rate'])
    expect(schema.safeParse({ ...newWorkspaceDefaults, name: 'ok' }).success).toBe(true)
  })
})

describe('edit workspace form', () => {
  it('keeps a non-preset retention and clears the rate limit when emptied', () => {
    expect(retentionChoice(86_400)).toBe('24h')
    expect(retentionChoice(7_200)).toBe('7200')
    const request = toUpdateRequest({
      name: 'QA',
      description: ' ',
      retention: '7200',
      rateLimit: '',
    })
    expect(UpdateWorkspaceRequest.parse(request)).toEqual({
      name: 'QA',
      description: null,
      retention: 7_200,
      rateLimit: null,
    })
    const values = { name: 'QA', description: '', retention: '1h', rateLimit: '' }
    expect(editWorkspaceSchema(m).safeParse(values).success).toBe(true)
  })

  it('shows a rate limit per second', () => {
    expect(rateLimitText(null)).toBe('')
    expect(rateLimitText({ limit: 10, windowSeconds: 1 })).toBe('10')
    expect(rateLimitText({ limit: 90, windowSeconds: 60 })).toBe('2')
  })
})
