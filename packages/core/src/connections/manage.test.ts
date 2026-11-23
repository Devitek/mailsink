import { CreatedConnection } from '@mailsink/contracts'
import { apiKeys, connections, findActiveApiKeyByHash, insertWorkspace, newId } from '@mailsink/db'
import { createTestWorkspace, describeDb } from '@mailsink/db/testing'
import { eq } from 'drizzle-orm'
import { expect, it } from 'vitest'
import { hashApiKey } from '../crypto'
import { verifySmtpPassword } from './credentials'
import {
  addConnection,
  type ManageOptions,
  removeConnection,
  rotateConnectionCredentials,
  updateConnectionSettings,
} from './manage'

const options: ManageOptions = {
  endpoints: { publicUrl: 'https://mail.test', smtpHost: 'mail.test', smtpPort: 2525 },
  now: new Date('2026-11-23T10:00:00.000Z'),
}

describeDb('connection management', (ctx) => {
  it('adds a keyed connection to an existing workspace, secrets answered once', async () => {
    const ws = await createTestWorkspace(ctx.db)
    const created = await addConnection(ctx.db, ws.slug, { kind: 'brevo', name: 'Brevo' }, options)
    expect(CreatedConnection.parse(created)).toEqual(created)
    expect(created.credentials).toMatchObject({ kind: 'brevo', baseUrl: 'https://mail.test/v3' })
    expect(created.envSnippet).toContain('BREVO_API_KEY=msk_')
    if (created.credentials.kind === 'smtp') throw new Error('unexpected kind')
    const found = await findActiveApiKeyByHash(ctx.db, hashApiKey(created.credentials.apiKey))
    expect(found?.connection?.id).toBe(created.id)
  })

  it('adds an SMTP connection, a taken username is a conflict', async () => {
    const ws = await createTestWorkspace(ctx.db)
    const user = `u-${ws.id.slice(-10)}`
    const smtp = await addConnection(
      ctx.db,
      ws.id,
      { kind: 'smtp', name: 'SMTP', smtpUsername: user },
      options,
    )
    expect(smtp).toMatchObject({ smtpUsername: user, keyPreview: null })
    await expect(
      addConnection(ctx.db, ws.id, { kind: 'smtp', name: 'Again', smtpUsername: user }, options),
    ).rejects.toMatchObject({ code: 'conflict' })
  })

  it('rotates a key: the old one is revoked, the new one works', async () => {
    const ws = await createTestWorkspace(ctx.db)
    const created = await addConnection(ctx.db, ws.id, { kind: 'resend', name: 'R' }, options)
    const rotated = await rotateConnectionCredentials(ctx.db, ws.slug, created.id, options)
    if (created.credentials.kind !== 'resend' || rotated.credentials.kind !== 'resend') {
      throw new Error('unexpected kind')
    }
    expect(rotated.credentials.apiKey).not.toBe(created.credentials.apiKey)
    expect(rotated.keyPreview).toBe(`${rotated.credentials.apiKey.slice(0, 12)}…`)
    expect(await findActiveApiKeyByHash(ctx.db, hashApiKey(created.credentials.apiKey))).toBe(
      undefined,
    )
    const fresh = await findActiveApiKeyByHash(ctx.db, hashApiKey(rotated.credentials.apiKey))
    expect(fresh?.connection?.id).toBe(created.id)
    const keys = await ctx.db.select().from(apiKeys).where(eq(apiKeys.connectionId, created.id))
    expect(keys.filter((k) => k.revokedAt).map((k) => k.revokedAt)).toEqual([options.now])
  })

  it('rotates an SMTP password, keeping the username', async () => {
    const ws = await createTestWorkspace(ctx.db)
    const smtp = await addConnection(ctx.db, ws.id, { kind: 'smtp', name: 'S' }, options)
    const rotated = await rotateConnectionCredentials(ctx.db, ws.id, smtp.id, options)
    if (smtp.credentials.kind !== 'smtp' || rotated.credentials.kind !== 'smtp') {
      throw new Error('unexpected kind')
    }
    expect(rotated.credentials.smtpUser).toBe(smtp.credentials.smtpUser)
    const [row] = await ctx.db.select().from(connections).where(eq(connections.id, smtp.id))
    const hash = row?.smtpPasswordHash ?? ''
    expect(await verifySmtpPassword(smtp.credentials.smtpPass, hash)).toBe(false)
    expect(await verifySmtpPassword(rotated.credentials.smtpPass, hash)).toBe(true)
    expect(rotated.envSnippet).toContain(`SMTP_PASS=${rotated.credentials.smtpPass}\n`)
  })

  it('renames, disables and enables a connection', async () => {
    const ws = await createTestWorkspace(ctx.db)
    const created = await addConnection(ctx.db, ws.id, { kind: 'resend', name: 'R' }, options)
    const off = await updateConnectionSettings(
      ctx.db,
      ws.id,
      created.id,
      { name: 'Renamed', enabled: false },
      options,
    )
    expect(off).toMatchObject({ name: 'Renamed', disabledAt: '2026-11-23T10:00:00.000Z' })
    expect(off.keyPreview).toBe(created.keyPreview)
    const on = await updateConnectionSettings(ctx.db, ws.id, created.id, { enabled: true })
    expect(on.disabledAt).toBeNull()
  })

  it('deletes a connection with its keys; another workspace cannot reach it', async () => {
    const ws = await createTestWorkspace(ctx.db)
    const other = await insertWorkspace(ctx.db, {
      id: newId('ws'),
      slug: `other-${ws.id.slice(-8)}`,
      name: 'Other',
      createdVia: 'ui',
    })
    const created = await addConnection(ctx.db, ws.id, { kind: 'resend', name: 'R' }, options)
    const notFound = { code: 'not_found' }
    await expect(removeConnection(ctx.db, other.id, created.id)).rejects.toMatchObject(notFound)
    await expect(
      rotateConnectionCredentials(ctx.db, other.id, created.id, options),
    ).rejects.toMatchObject(notFound)
    await removeConnection(ctx.db, ws.id, created.id)
    const keys = await ctx.db.select().from(apiKeys).where(eq(apiKeys.connectionId, created.id))
    expect(keys).toEqual([])
    await expect(removeConnection(ctx.db, ws.id, created.id)).rejects.toMatchObject(notFound)
    await expect(
      addConnection(ctx.db, 'no-such-ws', { kind: 'resend', name: 'R' }, options),
    ).rejects.toMatchObject({ code: 'not_found', message: 'Workspace not found' })
  })
})
