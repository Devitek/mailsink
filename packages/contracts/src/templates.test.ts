import { describe, expect, it } from 'vitest'
import { CreateWorkspaceRequest } from './admin'
import { issueCode } from './common'
import { TemplateInput, TemplateParams, TemplatePatch } from './templates'

describe('templates contracts', () => {
  it('needs html or text and parses the sender address', () => {
    const parsed = TemplateInput.parse({
      name: 'Welcome',
      subject: 'Hi',
      text: 'Hello',
      sender: 'App <APP@x.io>',
    })
    expect(parsed.sender).toEqual({ email: 'app@x.io', name: 'App' })
    const error = TemplateInput.safeParse({ name: 'W', subject: 'Hi' }).error
    expect(issueCode(error?.issues[0])).toBe('html_or_text_required')
  })

  it('takes a positive 32-bit externalId, numeric in the path', () => {
    expect(TemplateParams.parse({ id: 'my-ws', templateId: '12' }).templateId).toBe(12)
    expect(TemplateParams.safeParse({ id: 'my-ws', templateId: '0' }).success).toBe(false)
    expect(
      TemplateInput.safeParse({ externalId: 2 ** 31, name: 'W', subject: 'S', text: 't' }).success,
    ).toBe(false)
  })

  it('refuses an empty patch', () => {
    expect(issueCode(TemplatePatch.safeParse({}).error?.issues[0])).toBe('empty_patch')
    expect(TemplatePatch.parse({ html: null })).toEqual({ html: null })
  })

  it('accepts a template seed in CreateWorkspaceRequest', () => {
    const parsed = CreateWorkspaceRequest.parse({
      name: 'Seeded',
      templates: [{ name: 'W', subject: 'S', html: '<p/>' }],
    })
    expect(parsed.templates).toHaveLength(1)
  })
})
