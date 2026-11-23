import { CreateWorkspaceRequest, TemplateInput, TemplatePatch } from '@mailsink/contracts'
import { createTestWorkspace, describeDb } from '@mailsink/db/testing'
import { beforeAll, expect, it } from 'vitest'
import { isDomainError } from '../errors'
import { createWorkspace } from '../workspaces/provision'
import {
  createTemplate,
  getTemplateView,
  listTemplateViews,
  patchTemplate,
  removeTemplate,
} from './service'

const input = (patch: Record<string, unknown> = {}) =>
  TemplateInput.parse({
    name: 'Welcome',
    subject: 'Hi {{ params.name }}',
    html: '<p>Hi</p>',
    ...patch,
  })

const codeOf = async (promise: Promise<unknown>) => {
  const error = await promise.catch((e: unknown) => e)
  return isDomainError(error) ? error.code : error
}

const endpoints = { publicUrl: 'http://mailsink.test', smtpHost: 'localhost', smtpPort: 1025 }

describeDb('templates service', (ctx) => {
  let slug: string
  beforeAll(async () => {
    slug = (await createTestWorkspace(ctx.db)).slug
  })

  it('creates with the next free externalId, or the given one', async () => {
    expect((await createTemplate(ctx.db, slug, input())).externalId).toBe(1)
    expect((await createTemplate(ctx.db, slug, input({ externalId: 10 }))).externalId).toBe(10)
    const next = await createTemplate(ctx.db, slug, input({ sender: 'App <app@x.io>' }))
    expect(next).toMatchObject({ externalId: 11, sender: { email: 'app@x.io', name: 'App' } })
  })

  it('answers 409 on a taken externalId and 404 on an unknown workspace', async () => {
    expect(await codeOf(createTemplate(ctx.db, slug, input({ externalId: 10 })))).toBe('conflict')
    expect(await codeOf(createTemplate(ctx.db, 'nope-nope', input()))).toBe('not_found')
  })

  it('lists in externalId order with a cursor', async () => {
    const first = await listTemplateViews(ctx.db, slug, { limit: 2 })
    expect(first.data.map((t) => t.externalId)).toEqual([1, 10])
    expect(first.nextCursor).toBe('10')
    const second = await listTemplateViews(ctx.db, slug, { limit: 2, cursor: 10 })
    expect(second).toMatchObject({ data: [{ externalId: 11 }], nextCursor: null })
  })

  it('patches some fields and refuses a template without body', async () => {
    const patched = await patchTemplate(ctx.db, slug, 1, TemplatePatch.parse({ text: 'Hi' }))
    expect(patched).toMatchObject({ html: '<p>Hi</p>', text: 'Hi', name: 'Welcome' })
    const empty = TemplatePatch.parse({ html: null, text: null })
    expect(await codeOf(patchTemplate(ctx.db, slug, 1, empty))).toBe('validation_error')
    expect(await codeOf(patchTemplate(ctx.db, slug, 99, TemplatePatch.parse({ name: 'x' })))).toBe(
      'not_found',
    )
  })

  it('deletes, then answers 404', async () => {
    await removeTemplate(ctx.db, slug, 11)
    expect(await codeOf(getTemplateView(ctx.db, slug, 11))).toBe('not_found')
    expect(await codeOf(removeTemplate(ctx.db, slug, 11))).toBe('not_found')
  })

  it('seeds templates with a new workspace, all or nothing', async () => {
    const options = { endpoints, defaultIdleTtlSeconds: 3600 }
    const created = await createWorkspace(
      ctx.db,
      CreateWorkspaceRequest.parse({
        name: 'Seeded',
        templates: [input({ externalId: 5 }), input({ name: 'Second' })],
      }),
      options,
    )
    const listed = await listTemplateViews(ctx.db, created.workspace.id, { limit: 10 })
    expect(listed.data.map((t) => [t.externalId, t.name])).toEqual([
      [5, 'Welcome'],
      [6, 'Second'],
    ])
    const duplicate = CreateWorkspaceRequest.parse({
      name: 'Dup',
      slug: 'dup-templates',
      templates: [input({ externalId: 3 }), input({ externalId: 3 })],
    })
    expect(await codeOf(createWorkspace(ctx.db, duplicate, options))).toBe('conflict')
    expect(await codeOf(listTemplateViews(ctx.db, 'dup-templates', { limit: 1 }))).toBe('not_found')
  })
})
