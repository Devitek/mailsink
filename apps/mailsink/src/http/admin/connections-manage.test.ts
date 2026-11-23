import { CreatedConnection } from '@mailsink/contracts'
import { hashApiKey } from '@mailsink/core'
import { findActiveApiKeyByHash, findConnection } from '@mailsink/db'
import { describeDb } from '@mailsink/db/testing'
import { afterAll, beforeAll, expect, it } from 'vitest'
import { stopRuntime } from '../../runtime/boot'
import { ADMIN_KEY, installTestRuntime, request, seedWorkspace } from '../test-fixtures'
import { deleteConnection, patchConnection, postConnection } from './connections'

// Admin API parity with the web UI (owner decision of 23/11, #105): create, rename,
// disable and delete a connection.
describeDb('Admin API: connection management', (ctx) => {
  let seeded: Awaited<ReturnType<typeof seedWorkspace>>
  beforeAll(async () => {
    await installTestRuntime(ctx.handle, { publicUrl: 'https://mail.test' })
    seeded = await seedWorkspace(ctx.db)
  })
  afterAll(() => stopRuntime())

  const call = async (
    handler: typeof postConnection,
    method: string,
    params: Record<string, string>,
    body?: unknown,
    bearer = ADMIN_KEY,
  ) => {
    const path = `/admin/workspaces/${params.id}/connections/${params.connectionId ?? ''}`
    const response = await handler({
      request: request(path, {
        method,
        bearer,
        headers: { 'content-type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
      params,
    })
    const text = await response.text()
    return { status: response.status, body: text ? JSON.parse(text) : null }
  }

  it('creates a connection and answers its secrets once (201)', async () => {
    const { workspace } = seeded
    const res = await call(
      postConnection,
      'POST',
      { id: workspace.slug },
      {
        kind: 'brevo',
        name: 'Brevo',
      },
    )
    expect(res.status).toBe(201)
    const created = CreatedConnection.parse(res.body)
    expect(created.kind).toBe('brevo')
    if (created.credentials.kind !== 'brevo') throw new Error('unexpected kind')
    const key = await findActiveApiKeyByHash(ctx.db, hashApiKey(created.credentials.apiKey))
    expect(key?.connection?.id).toBe(created.id)
  })

  it('renames, disables and enables a connection', async () => {
    const { workspace, connection } = seeded
    const params = { id: workspace.id, connectionId: connection.id }
    const renamed = await call(patchConnection, 'PATCH', params, {
      name: 'Billing',
      enabled: false,
    })
    expect(renamed).toMatchObject({ status: 200, body: { name: 'Billing' } })
    expect(renamed.body.disabledAt).toEqual(expect.any(String))
    const enabled = await call(patchConnection, 'PATCH', params, { enabled: true })
    expect(enabled.body).toMatchObject({ name: 'Billing', disabledAt: null })
    const empty = await call(patchConnection, 'PATCH', params, {})
    expect(empty.status).toBe(422)
  })

  it('deletes a connection (204), then answers 404', async () => {
    const other = await seedWorkspace(ctx.db)
    const params = { id: other.workspace.slug, connectionId: other.connection.id }
    expect((await call(deleteConnection, 'DELETE', params)).status).toBe(204)
    expect(await findConnection(ctx.db, other.workspace.id, other.connection.id)).toBeUndefined()
    const again = await call(deleteConnection, 'DELETE', params)
    expect(again).toMatchObject({ status: 404, body: { error: { code: 'not_found' } } })
  })

  it('needs the admin key', async () => {
    const { workspace, workspaceKey } = seeded
    const res = await call(
      postConnection,
      'POST',
      { id: workspace.id },
      { kind: 'smtp' },
      workspaceKey,
    )
    expect(res.status).toBe(401)
  })
})
