import { CreatedConnection } from '@mailsink/contracts'
import { hashApiKey } from '@mailsink/core'
import { findActiveApiKeyByHash } from '@mailsink/db'
import { describeDb } from '@mailsink/db/testing'
import { afterAll, beforeAll, expect, it } from 'vitest'
import { stopRuntime } from '../../runtime/boot'
import { ADMIN_KEY, installTestRuntime, request, seedWorkspace } from '../test-fixtures'
import { rotateConnection } from './connections'

describeDb('Admin API: connection key rotation', (ctx) => {
  let seeded: Awaited<ReturnType<typeof seedWorkspace>>
  beforeAll(async () => {
    await installTestRuntime(ctx.handle, { publicUrl: 'https://mail.test' })
    seeded = await seedWorkspace(ctx.db)
  })
  afterAll(() => stopRuntime())

  const rotate = async (bearer: string, id: string, connectionId: string) => {
    const path = `/admin/workspaces/${id}/connections/${connectionId}/rotate`
    const response = await rotateConnection({
      request: request(path, { method: 'POST', bearer }),
      params: { id, connectionId },
    })
    return { status: response.status, body: await response.json() }
  }

  it('answers a new key once and revokes the previous one', async () => {
    const { workspace, connection, connectionKey } = seeded
    const res = await rotate(ADMIN_KEY, workspace.slug, connection.id)
    expect(res.status).toBe(200)
    const body = CreatedConnection.parse(res.body)
    expect(body.envSnippet).toMatch(
      /^RESEND_API_KEY=msk_.+\nRESEND_BASE_URL=https:\/\/mail.test\n$/,
    )

    expect(await findActiveApiKeyByHash(ctx.db, hashApiKey(connectionKey))).toBeUndefined()
    if (body.credentials.kind !== 'resend') throw new Error('unexpected kind')
    const fresh = await findActiveApiKeyByHash(ctx.db, hashApiKey(body.credentials.apiKey))
    expect(fresh?.connection?.id).toBe(connection.id)
  })

  it('needs the admin key and a connection of that workspace', async () => {
    const { workspace, connection, workspaceKey } = seeded
    expect((await rotate(workspaceKey, workspace.id, connection.id)).status).toBe(401)
    const other = await seedWorkspace(ctx.db)
    const res = await rotate(ADMIN_KEY, other.workspace.id, connection.id)
    expect(res).toMatchObject({ status: 404, body: { error: { code: 'not_found' } } })
  })
})
