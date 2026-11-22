import { and, eq, isNull } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { newId } from '../src/ids'
import { apiKeys, overrides, webhookEndpoints } from '../src/schema'
import { createTestConnection, createTestWorkspace, describeDb, pgCode } from '../src/testing'

const UNIQUE_VIOLATION = '23505'
const CHECK_VIOLATION = '23514'

describeDb('constraints', (ctx) => {
  describe('overrides_active_scope_uq', () => {
    const activate = (workspaceId: string, connectionId?: string) =>
      ctx.db.insert(overrides).values({
        id: newId('ovr'),
        workspaceId,
        connectionId,
        config: { chaos: { errorRate: 50, httpCodes: [500], smtpCodes: [451] } },
        activatedVia: 'api',
      })

    it('allows one active override per scope (workspace and each connection)', async () => {
      const ws = await createTestWorkspace(ctx.db)
      const a = await createTestConnection(ctx.db, ws.id)
      const b = await createTestConnection(ctx.db, ws.id)
      await activate(ws.id)
      await activate(ws.id, a.id)
      await activate(ws.id, b.id)
      await expect(activate(ws.id)).rejects.toSatisfy((e) => pgCode(e) === UNIQUE_VIOLATION)
      await expect(activate(ws.id, a.id)).rejects.toSatisfy((e) => pgCode(e) === UNIQUE_VIOLATION)
    })

    it('keeps reset overrides as history and allows a new active one', async () => {
      const ws = await createTestWorkspace(ctx.db)
      await activate(ws.id)
      await ctx.db
        .update(overrides)
        .set({ resetAt: new Date() })
        .where(and(eq(overrides.workspaceId, ws.id), isNull(overrides.resetAt)))
      await activate(ws.id)
      const all = await ctx.db.select().from(overrides).where(eq(overrides.workspaceId, ws.id))
      expect(all).toHaveLength(2)
    })
  })

  describe('webhook_secret_required', () => {
    const endpoint = async (payloadFormat: 'unified' | 'resend' | 'brevo', secret?: string) => {
      const ws = await createTestWorkspace(ctx.db)
      const [row] = await ctx.db
        .insert(webhookEndpoints)
        .values({
          id: newId('whe'),
          workspaceId: ws.id,
          url: 'https://hooks.example.com/mailsink',
          payloadFormat,
          events: ['email.delivered', 'email.hard_bounced'],
          secret,
        })
        .returning()
      return row
    }

    it.each(['unified', 'resend'] as const)('rejects a %s endpoint without secret', async (f) => {
      await expect(endpoint(f)).rejects.toSatisfy((e) => pgCode(e) === CHECK_VIOLATION)
    })

    it('accepts a brevo endpoint without secret and assigns numeric ids', async () => {
      const first = await endpoint('brevo')
      const second = await endpoint('unified', 'whsec_abc')
      expect(first?.brevoAuth).toBe('none')
      expect(first?.events).toEqual(['email.delivered', 'email.hard_bounced'])
      expect(second?.numericId).toBeGreaterThan(first?.numericId ?? Number.POSITIVE_INFINITY)
    })
  })

  describe('credential checks', () => {
    it('requires an smtp username exactly for smtp connections', async () => {
      const ws = await createTestWorkspace(ctx.db)
      await createTestConnection(ctx.db, ws.id, { kind: 'smtp', smtpUsername: newId('u') })
      await expect(createTestConnection(ctx.db, ws.id, { kind: 'smtp' })).rejects.toSatisfy(
        (e) => pgCode(e) === CHECK_VIOLATION,
      )
      await expect(
        createTestConnection(ctx.db, ws.id, { kind: 'brevo', smtpUsername: newId('u') }),
      ).rejects.toSatisfy((e) => pgCode(e) === CHECK_VIOLATION)
    })

    it('ties the api key scope to the presence of a connection', async () => {
      const ws = await createTestWorkspace(ctx.db)
      const key = (scope: 'workspace' | 'connection', connectionId?: string) =>
        ctx.db.insert(apiKeys).values({
          id: newId('key'),
          workspaceId: ws.id,
          connectionId,
          scope,
          displayPrefix: 'mskw_',
          hash: newId('h'),
        })
      await key('workspace')
      await expect(key('connection')).rejects.toSatisfy((e) => pgCode(e) === CHECK_VIOLATION)
    })
  })
})
