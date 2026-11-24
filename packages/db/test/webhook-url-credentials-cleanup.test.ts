import { sql } from 'drizzle-orm'
import { afterAll, beforeAll, expect, it } from 'vitest'
import { migrate } from '../src/migrate'
import { createTestWorkspace, describeDb } from '../src/testing'
import { migrationsUpTo } from './journal'

type Row = {
  id: string
  url: string
  brevo_auth: string
  secret: string | null
  events: string
}

// Migration 0004 (#153): credentials written in a brevo endpoint URL before D278 move to
// brevoAuth basic (D281), and Resend endpoints subscribed to `email.failed` also get the
// new `email.invalid` (Resend emits both as email.failed, D280).
describeDb(
  'migration 0004: webhook endpoints',
  (ctx) => {
    let legacy: Awaited<ReturnType<typeof migrationsUpTo>>
    let rows: Map<string, Row>

    beforeAll(async () => {
      legacy = await migrationsUpTo('0003_api_log_response_headers')
      await migrate(ctx.handle, { migrationsFolder: legacy.folder })
      const ws = await createTestWorkspace(ctx.db)
      const endpoint = (
        id: string,
        format: string,
        url: string,
        auth: string,
        secret: string | null,
        events: string,
      ) =>
        sql`insert into webhook_endpoints
          (id, workspace_id, url, payload_format, events, secret, brevo_auth)
          values (${id}, ${ws.id}, ${url}, ${format}::payload_format,
            ${events}::webhook_event[], ${secret}, ${auth}::brevo_auth_type)`
      for (const statement of [
        endpoint(
          'whe_basic',
          'brevo',
          'https://ops%40acme:p%3As%20s@hooks.example.test/brevo?x=1',
          'none',
          null,
          '{email.delivered}',
        ),
        endpoint('whe_user', 'brevo', 'https://ops@hooks.example.test/', 'none', null, '{}'),
        endpoint(
          'whe_bad',
          'brevo',
          'https://ops:%E9t%C3%A9@hooks.example.test/',
          'none',
          null,
          '{}',
        ),
        endpoint('whe_bearer', 'brevo', 'https://u:p@hooks.example.test/', 'bearer', 'tok', '{}'),
        endpoint('whe_plain', 'brevo', 'https://hooks.example.test/a@b', 'none', null, '{}'),
        endpoint(
          'whe_unified',
          'unified',
          'https://u:p@hooks.example.test/',
          'none',
          'k',
          '{email.failed}',
        ),
        endpoint(
          'whe_resend',
          'resend',
          'https://hooks.example.test/',
          'none',
          'k',
          '{email.sent,email.failed}',
        ),
      ]) {
        await ctx.db.execute(statement)
      }
      await migrate(ctx.handle)
      const result = await ctx.db.execute<Row>(
        sql`select id, url, brevo_auth, secret, events::text as events from webhook_endpoints`,
      )
      rows = new Map(result.rows.map((r) => [r.id, r]))
    }, 60_000)
    afterAll(() => legacy?.dispose())

    it('moves URL credentials of brevo endpoints to brevoAuth basic, percent-decoded', () => {
      expect(rows.get('whe_basic')).toMatchObject({
        url: 'https://hooks.example.test/brevo?x=1',
        brevo_auth: 'basic',
        secret: 'ops@acme:p:s s',
      })
      expect(rows.get('whe_user')).toMatchObject({
        url: 'https://hooks.example.test/',
        brevo_auth: 'basic',
        secret: 'ops:',
      })
    })

    it('keeps a part that is not valid percent-encoded UTF-8 as written', () => {
      expect(rows.get('whe_bad')).toMatchObject({ brevo_auth: 'basic', secret: 'ops:%E9t%C3%A9' })
    })

    it('leaves other rows to the send-time fallback', () => {
      expect(rows.get('whe_bearer')).toMatchObject({ url: 'https://u:p@hooks.example.test/' })
      expect(rows.get('whe_plain')).toMatchObject({ url: 'https://hooks.example.test/a@b' })
      expect(rows.get('whe_unified')).toMatchObject({
        url: 'https://u:p@hooks.example.test/',
        events: '{email.failed}',
      })
    })

    it('subscribes Resend endpoints that receive email.failed to email.invalid', () => {
      expect(rows.get('whe_resend')?.events).toBe('{email.sent,email.failed,email.invalid}')
    })
  },
  { migrate: false },
)
