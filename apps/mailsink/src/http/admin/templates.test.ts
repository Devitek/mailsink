import { describeDb } from '@mailsink/db/testing'
import { afterAll, beforeAll, expect, it } from 'vitest'
import { stopRuntime } from '../../runtime/boot'
import { provisionBrevo } from '../dialects/brevo/testing'
import { ADMIN_KEY, installTestRuntime, request } from '../test-fixtures'
import {
  deleteTemplate,
  getTemplate,
  listTemplates,
  patchTemplate,
  postTemplate,
} from './templates'

const tpl = { name: 'Welcome', subject: 'Hi {{ params.name }}', html: '<p>Hi</p>' }

describeDb('Admin templates routes', (ctx) => {
  let workspaceId: string
  let workspaceKey: string
  const call = (
    route: typeof postTemplate,
    path: string,
    params: Record<string, string>,
    init: { method?: string; body?: unknown; bearer?: string } = {},
  ) =>
    route({
      request: request(`/admin/workspaces/${params.id}/templates${path}`, {
        method: init.method ?? 'GET',
        bearer: init.bearer ?? ADMIN_KEY,
        headers: { 'content-type': 'application/json' },
        ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
      }),
      params,
    })

  beforeAll(async () => {
    await installTestRuntime(ctx.handle)
    const seed = await provisionBrevo({ templates: [{ ...tpl, externalId: 7 }] })
    workspaceId = seed.workspaceId
    workspaceKey = seed.workspaceKey
  })
  afterAll(() => stopRuntime())

  it('lists the templates seeded at provisioning', async () => {
    const res = await call(listTemplates, '', { id: workspaceId })
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ data: [{ externalId: 7, ...tpl }], nextCursor: null })
  })

  it('creates (201), conflicts (409) and validates (422)', async () => {
    const created = await call(postTemplate, '', { id: workspaceId }, { method: 'POST', body: tpl })
    expect(created.status).toBe(201)
    expect(await created.json()).toMatchObject({
      id: expect.stringMatching(/^tpl_/),
      externalId: 8,
    })
    const taken = await call(
      postTemplate,
      '',
      { id: workspaceId },
      {
        method: 'POST',
        body: { ...tpl, externalId: 7 },
      },
    )
    expect(taken.status).toBe(409)
    const invalid = await call(
      postTemplate,
      '',
      { id: workspaceId },
      {
        method: 'POST',
        body: { name: 'x', subject: 'y' },
      },
    )
    expect(invalid.status).toBe(422)
    expect((await invalid.json()).error.details.issues[0].params).toEqual({
      code: 'html_or_text_required',
    })
  })

  it('reads, patches and deletes by numeric templateId', async () => {
    const params = { id: workspaceId, templateId: '8' }
    expect((await call(getTemplate, '/8', params)).status).toBe(200)
    const patched = await call(patchTemplate, '/8', params, {
      method: 'PATCH',
      body: { subject: 'New' },
    })
    expect(await patched.json()).toMatchObject({ externalId: 8, subject: 'New', name: 'Welcome' })
    expect((await call(deleteTemplate, '/8', params, { method: 'DELETE' })).status).toBe(204)
    expect((await call(getTemplate, '/8', params)).status).toBe(404)
    expect((await call(getTemplate, '/x', { id: workspaceId, templateId: 'x' })).status).toBe(422)
  })

  it('needs the admin key', async () => {
    const res = await call(listTemplates, '', { id: workspaceId }, { bearer: workspaceKey })
    expect(res.status).toBe(401)
  })
})
