import { CreateWorkspaceRequest } from '@mailsink/contracts'
import { findActiveApiKeyByHash } from '@mailsink/db'
import { createTestWorkspace, describeDb } from '@mailsink/db/testing'
import { expect, it } from 'vitest'
import { hashApiKey } from '../crypto'
import { createWorkspace } from './provision'
import { rotateWorkspaceKey, workspaceKeyPreview } from './workspace-key'

const endpoints = { publicUrl: 'https://mail.test', smtpHost: 'mail.test', smtpPort: 2525 }

describeDb('workspace key rotation', (ctx) => {
  it('revokes the previous mskw_ key at once and answers the new one', async () => {
    const created = await createWorkspace(ctx.db, CreateWorkspaceRequest.parse({ name: 'QA' }), {
      endpoints,
      defaultIdleTtlSeconds: 3600,
    })
    const old = created.workspaceKey
    expect(await findActiveApiKeyByHash(ctx.db, hashApiKey(old))).toBeDefined()

    const rotated = await rotateWorkspaceKey(ctx.db, created.workspace.slug)
    expect(rotated.workspaceKey).toMatch(/^mskw_/)
    expect(rotated.workspaceKey).not.toBe(old)
    expect(rotated.keyPreview).toBe(
      `${rotated.workspaceKey.slice(0, rotated.keyPreview.length - 1)}…`,
    )
    expect(await findActiveApiKeyByHash(ctx.db, hashApiKey(old))).toBeUndefined()
    const fresh = await findActiveApiKeyByHash(ctx.db, hashApiKey(rotated.workspaceKey))
    expect(fresh?.key.scope).toBe('workspace')
    expect(fresh?.workspace.id).toBe(created.workspace.id)
    expect(await workspaceKeyPreview(ctx.db, created.workspace.id)).toBe(rotated.keyPreview)
  })

  it('creates a key for a workspace that had none, not_found for an unknown one', async () => {
    const ws = await createTestWorkspace(ctx.db)
    expect(await workspaceKeyPreview(ctx.db, ws.id)).toBeNull()
    await rotateWorkspaceKey(ctx.db, ws.id)
    expect(await workspaceKeyPreview(ctx.db, ws.id)).toMatch(/^mskw_.+…$/)
    await expect(rotateWorkspaceKey(ctx.db, 'nope')).rejects.toMatchObject({ code: 'not_found' })
  })
})
