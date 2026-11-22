import {
  CreateWorkspaceResponse,
  ListWorkspacesResponse,
  WorkspaceDetail,
} from '@mailsink/contracts'
import { describeDb } from '@mailsink/db/testing'
import { afterAll, beforeAll, expect, it } from 'vitest'
import { stopRuntime } from '../../runtime/boot'
import { ADMIN_KEY, installTestRuntime, request, seedWorkspace } from '../test-fixtures'
import { deleteWorkspace, getWorkspace, listWorkspaces, postWorkspace } from './workspaces'

const json = (body: unknown) => ({
  method: 'POST',
  body: JSON.stringify(body),
  headers: { 'content-type': 'application/json' },
})

async function call(
  route: typeof getWorkspace,
  path: string,
  init: Parameters<typeof request>[1] = {},
  params?: Record<string, string>,
) {
  const response = await route({ request: request(path, { bearer: ADMIN_KEY, ...init }), params })
  const text = await response.text()
  return { status: response.status, body: text ? JSON.parse(text) : null }
}

describeDb('Admin API: workspaces', (ctx) => {
  let seeded: Awaited<ReturnType<typeof seedWorkspace>>
  beforeAll(async () => {
    await installTestRuntime(ctx.handle, { publicUrl: 'https://mail.test', smtpPort: 2525 })
    seeded = await seedWorkspace(ctx.db)
  })
  afterAll(() => stopRuntime())

  it('refuses anything but the admin key', async () => {
    for (const bearer of [seeded.connectionKey, seeded.workspaceKey, 'nope']) {
      const res = await call(listWorkspaces, '/admin/workspaces', { bearer })
      expect(res).toMatchObject({ status: 401, body: { error: { code: 'unauthorized' } } })
    }
  })

  it('creates a workspace with its connections and shows the secrets once', async () => {
    const res = await call(
      postWorkspace,
      '/admin/workspaces',
      json({
        name: 'Staging',
        slug: 'staging',
        connections: [
          { kind: 'resend', name: 'Resend' },
          { kind: 'smtp', name: 'SMTP' },
        ],
      }),
    )
    expect(res.status).toBe(201)
    const body = CreateWorkspaceResponse.parse(res.body)
    expect(body.workspace.urls.ui).toBe('https://mail.test/w/staging')
    expect(body.connections[0]?.envSnippet).toMatch(
      /^RESEND_API_KEY=msk_.+\nRESEND_BASE_URL=https:\/\/mail\.test\n$/,
    )
    expect(body.connections[1]?.credentials).toMatchObject({
      smtpHost: 'mail.test',
      smtpPort: 2525,
    })

    const detail = await call(getWorkspace, '/admin/workspaces/staging', {}, { id: 'staging' })
    expect(detail.status).toBe(200)
    WorkspaceDetail.parse(detail.body)
    expect(JSON.stringify(detail.body)).not.toContain(body.workspaceKey)
    expect(detail.body.connections[0]).not.toHaveProperty('credentials')
  })

  it('validates the body with stable codes (D34) and maps conflicts to 409', async () => {
    const ttl = await call(
      postWorkspace,
      '/admin/workspaces',
      json({ name: 'P', idleTtlSeconds: 600 }),
    )
    expect(ttl.status).toBe(422)
    expect(ttl.body.error.details.issues[0].params).toEqual({ code: 'idle_ttl_requires_ephemeral' })
    const dup = await call(postWorkspace, '/admin/workspaces', json({ name: 'S', slug: 'staging' }))
    expect(dup).toMatchObject({ status: 409, body: { error: { code: 'conflict' } } })
  })

  it('lists persistent workspaces, ephemeral ones with includeEphemeral=true', async () => {
    const created = await call(
      postWorkspace,
      '/admin/workspaces',
      json({ name: 'CI', ephemeral: true }),
    )
    expect(created.body.workspace).toMatchObject({ ephemeral: true, idleTtlSeconds: 3600 })
    const ids = async (query: string) => {
      const res = await call(listWorkspaces, `/admin/workspaces${query}`)
      expect(res.status).toBe(200)
      return ListWorkspacesResponse.parse(res.body).data.map((w) => w.id)
    }
    expect(await ids('')).not.toContain(created.body.workspace.id)
    expect(await ids('?includeEphemeral=true')).toContain(created.body.workspace.id)
    const page = await call(listWorkspaces, '/admin/workspaces?includeEphemeral=1&limit=1')
    expect(page.body.data).toHaveLength(1)
    expect(page.body.nextCursor).toEqual(expect.any(String))
    const bad = await call(listWorkspaces, '/admin/workspaces?cursor=nope')
    expect(bad.status).toBe(422)
  })

  it('deletes a workspace (204) then answers 404', async () => {
    const id = seeded.workspace.id
    expect(
      await call(deleteWorkspace, `/admin/workspaces/${id}`, { method: 'DELETE' }, { id }),
    ).toEqual({ status: 204, body: null })
    const again = await call(
      deleteWorkspace,
      `/admin/workspaces/${id}`,
      { method: 'DELETE' },
      { id },
    )
    expect(again).toMatchObject({ status: 404, body: { error: { code: 'not_found' } } })
    const gone = await call(getWorkspace, `/admin/workspaces/${id}`, {}, { id })
    expect(gone.status).toBe(404)
  })
})

describeDb('Admin API without MAILSINK_ADMIN_KEY (D41, D43)', (ctx) => {
  beforeAll(() => installTestRuntime(ctx.handle, { adminKey: undefined }))
  afterAll(() => stopRuntime())

  it('refuses every call', async () => {
    for (const bearer of [ADMIN_KEY, '']) {
      const res = await call(listWorkspaces, '/admin/workspaces', { bearer })
      expect(res.status).toBe(401)
    }
  })
})
