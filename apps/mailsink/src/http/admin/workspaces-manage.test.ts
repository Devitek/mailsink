import { RotatedWorkspaceKey, WorkspaceView } from '@mailsink/contracts'
import { hashApiKey } from '@mailsink/core'
import { findActiveApiKeyByHash } from '@mailsink/db'
import { describeDb } from '@mailsink/db/testing'
import { afterAll, beforeAll, expect, it } from 'vitest'
import { stopRuntime } from '../../runtime/boot'
import { ADMIN_KEY, installTestRuntime, request, seedWorkspace } from '../test-fixtures'
import { patchWorkspace, rotateWorkspaceKeyApi } from './workspaces'

// Admin API parity with the web UI (#105, #106): edit a workspace, rotate its `mskw_` key.
describeDb('Admin API: workspace edit and key rotation', (ctx) => {
  let seeded: Awaited<ReturnType<typeof seedWorkspace>>
  beforeAll(async () => {
    await installTestRuntime(ctx.handle, { publicUrl: 'https://mail.test' })
    seeded = await seedWorkspace(ctx.db)
  })
  afterAll(() => stopRuntime())

  const call = async (
    handler: typeof patchWorkspace,
    method: string,
    id: string,
    body?: unknown,
    bearer = ADMIN_KEY,
  ) => {
    const response = await handler({
      request: request(`/admin/workspaces/${id}`, {
        method,
        bearer,
        headers: { 'content-type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
      params: { id },
    })
    const text = await response.text()
    return { status: response.status, body: text ? JSON.parse(text) : null }
  }

  it('edits the settings of a workspace by slug, the slug untouched', async () => {
    const { workspace } = seeded
    const res = await call(patchWorkspace, 'PATCH', workspace.slug, {
      name: 'QA team',
      retention: '24h',
      rateLimit: null,
    })
    expect(res.status).toBe(200)
    expect(WorkspaceView.parse(res.body)).toMatchObject({
      slug: workspace.slug,
      name: 'QA team',
      retentionSeconds: 86_400,
      rateLimit: null,
    })
  })

  it('validates the patch and answers 404 for an unknown workspace', async () => {
    expect((await call(patchWorkspace, 'PATCH', seeded.workspace.id, {})).status).toBe(422)
    const res = await call(patchWorkspace, 'PATCH', 'nope', { name: 'x' })
    expect(res).toMatchObject({ status: 404, body: { error: { code: 'not_found' } } })
  })

  it('rotates the workspace key: the old one stops working at once', async () => {
    const { workspace, workspaceKey } = seeded
    const res = await call(rotateWorkspaceKeyApi, 'POST', workspace.id)
    expect(res.status).toBe(200)
    const body = RotatedWorkspaceKey.parse(res.body)
    expect(await findActiveApiKeyByHash(ctx.db, hashApiKey(workspaceKey))).toBeUndefined()
    const fresh = await findActiveApiKeyByHash(ctx.db, hashApiKey(body.workspaceKey))
    expect(fresh?.key.scope).toBe('workspace')
  })

  it('needs the admin key', async () => {
    const other = await seedWorkspace(ctx.db)
    const res = await call(
      rotateWorkspaceKeyApi,
      'POST',
      other.workspace.id,
      undefined,
      other.workspaceKey,
    )
    expect(res.status).toBe(401)
  })
})
