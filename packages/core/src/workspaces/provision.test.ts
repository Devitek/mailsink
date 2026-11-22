import { CreateWorkspaceRequest, CreateWorkspaceResponse } from '@mailsink/contracts'
import { apiKeys, connections, findActiveApiKeyByHash, workspaces } from '@mailsink/db'
import { describeDb } from '@mailsink/db/testing'
import { eq } from 'drizzle-orm'
import { expect, it } from 'vitest'
import { verifySmtpPassword } from '../connections/credentials'
import { hashApiKey } from '../crypto'
import { createWorkspace, type ProvisionOptions } from './provision'

const options: ProvisionOptions = {
  endpoints: { publicUrl: 'https://mail.test', smtpHost: 'mail.test', smtpPort: 2525 },
  defaultIdleTtlSeconds: 3600,
  now: new Date('2026-11-22T10:00:00.000Z'),
}
const request = (input: unknown) => CreateWorkspaceRequest.parse(input)

describeDb('createWorkspace', (ctx) => {
  it('provisions a workspace with one connection per kind in one call', async () => {
    const res = await createWorkspace(
      ctx.db,
      request({
        name: 'Staging',
        rateLimit: { limit: 10 },
        connections: [
          { kind: 'resend', name: 'Resend', simulation: { openRate: 50 } },
          { kind: 'brevo', name: 'Brevo', rateLimit: { limit: 5, burst: 10 } },
          { kind: 'smtp', name: 'SMTP', smtpUsername: 'staging-smtp' },
        ],
      }),
      options,
    )
    expect(CreateWorkspaceResponse.parse(res)).toEqual(res)
    expect(res.workspace).toMatchObject({
      name: 'Staging',
      ephemeral: false,
      idleTtlSeconds: null,
      expiresAt: null,
      rateLimit: { limit: 10, windowSeconds: 1 },
      simulation: { rates: { delivered: 100 }, rules: [] },
      urls: {
        ui: `https://mail.test/w/${res.workspace.slug}`,
        capture: 'https://mail.test/capture',
        mcp: 'https://mail.test/mcp',
      },
    })
    expect(res.workspace.slug).toMatch(/^staging-[a-z0-9]{6}$/)
    const [resend, brevo, smtp] = res.connections
    expect(resend?.credentials).toMatchObject({ kind: 'resend', baseUrl: 'https://mail.test' })
    expect(resend?.keyPreview).toMatch(/^msk_.{8}…$/)
    expect(brevo?.rateLimit).toEqual({ limit: 5, burst: 10, windowSeconds: 1 })
    expect(smtp).toMatchObject({ smtpUsername: 'staging-smtp', keyPreview: null })
    expect(smtp?.envSnippet).toContain('SMTP_USER=staging-smtp\n')

    // Stored rows: parsed contract output (defaults filled), hashes only.
    const [con] = await ctx.db.select().from(connections).where(eq(connections.name, 'Brevo'))
    expect(con?.rateLimit).toEqual({ limit: 5, burst: 10, windowSeconds: 1 })
    const [smtpRow] = await ctx.db
      .select()
      .from(connections)
      .where(eq(connections.smtpUsername, 'staging-smtp'))
    if (smtp?.credentials.kind !== 'smtp' || !smtpRow?.smtpPasswordHash) throw new Error('smtp')
    expect(await verifySmtpPassword(smtp.credentials.smtpPass, smtpRow.smtpPasswordHash)).toBe(true)
    if (resend?.credentials.kind !== 'resend') throw new Error('resend')
    const key = await findActiveApiKeyByHash(ctx.db, hashApiKey(resend.credentials.apiKey))
    expect(key?.connection?.id).toBe(resend.id)
    const wsKey = await findActiveApiKeyByHash(ctx.db, hashApiKey(res.workspaceKey))
    expect(wsKey).toMatchObject({ key: { scope: 'workspace' }, connection: null })
    const stored = await ctx.db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.workspaceId, res.workspace.id))
    expect(stored).toHaveLength(3)
    expect(JSON.stringify(stored)).not.toContain(res.workspaceKey)
  })

  it('applies the default idle TTL and a denormalized expires_at to ephemeral workspaces', async () => {
    const byDefault = await createWorkspace(
      ctx.db,
      request({ name: 'CI', ephemeral: true }),
      options,
    )
    expect(byDefault.workspace).toMatchObject({
      ephemeral: true,
      idleTtlSeconds: 3600,
      lastActivityAt: '2026-11-22T10:00:00.000Z',
      expiresAt: '2026-11-22T11:00:00.000Z',
    })
    const custom = await createWorkspace(
      ctx.db,
      request({ name: 'CI', ephemeral: true, idleTtlSeconds: 120 }),
      options,
    )
    const [row] = await ctx.db
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, custom.workspace.id))
    expect(row?.expiresAt?.toISOString()).toBe('2026-11-22T10:02:00.000Z')
  })

  it('answers conflict on a taken slug or SMTP username and writes nothing', async () => {
    await createWorkspace(ctx.db, request({ name: 'A', slug: 'taken-slug' }), options)
    await expect(
      createWorkspace(ctx.db, request({ name: 'B', slug: 'taken-slug' }), options),
    ).rejects.toMatchObject({ code: 'conflict', message: 'This workspace slug is already taken' })
    const smtp = { kind: 'smtp', name: 'SMTP', smtpUsername: 'shared-user' }
    await createWorkspace(ctx.db, request({ name: 'C', connections: [smtp] }), options)
    await expect(
      createWorkspace(ctx.db, request({ name: 'D', slug: 'slug-d', connections: [smtp] }), options),
    ).rejects.toMatchObject({ code: 'conflict' })
    expect(await ctx.db.select().from(workspaces).where(eq(workspaces.slug, 'slug-d'))).toEqual([])
    await expect(
      createWorkspace(ctx.db, request({ name: 'E', connections: [smtp, smtp] }), options),
    ).rejects.toMatchObject({ code: 'conflict' })
  })
})
