import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describeDb } from '@mailsink/db/testing'
import { afterEach, expect, it } from 'vitest'
import { createSmtpAccount, startTestServer } from './testing'

const mail = { from: 'app@example.test', to: 'alice@example.test', subject: 's', text: 'x' }

/** A throwaway self-signed certificate, null when openssl is not installed. */
function selfSigned(): { key: Buffer; cert: Buffer } | null {
  const dir = mkdtempSync(join(tmpdir(), 'mailsink-smtp-tls-'))
  const [key, cert] = [join(dir, 'key.pem'), join(dir, 'cert.pem')]
  try {
    execFileSync(
      'openssl',
      [
        'req',
        '-x509',
        '-newkey',
        'ec',
        '-pkeyopt',
        'ec_paramgen_curve:prime256v1',
        '-nodes',
        '-keyout',
        key,
        '-out',
        cert,
        '-subj',
        '/CN=localhost',
        '-days',
        '1',
      ],
      { stdio: 'ignore' },
    )
  } catch {
    return null
  }
  return { key: readFileSync(key), cert: readFileSync(cert) }
}

describeDb('SMTP sessions', (ctx) => {
  let env: Awaited<ReturnType<typeof startTestServer>> | undefined

  afterEach(async () => {
    await env?.server.close()
    env = undefined
  })

  it('records an accepted session with its transcript, AUTH redacted', async () => {
    const account = await createSmtpAccount(ctx.db)
    env = await startTestServer(ctx.db)
    for (const authMethod of ['PLAIN', 'LOGIN']) {
      const transport = env.transport(account, { authMethod, name: 'client.test' })
      await transport.sendMail(mail)
      transport.close()
    }
    await expect.poll(() => env?.records.length).toBe(2)
    for (const record of env.records) {
      expect(record).toMatchObject({
        workspaceId: account.workspaceId,
        connectionId: account.connectionId,
        authUser: account.user,
        clientHostname: 'client.test',
        secure: false,
        outcome: 'accepted',
        error: null,
      })
      expect(record.id).toMatch(/^smtp_/)
      expect(record.messageIds).toHaveLength(1)
      const text = record.transcript.map((l) => `${l.dir} ${l.line}`).join('\n')
      expect(text).toMatch(/^S 220 /)
      expect(text).toContain('/* secured */')
      expect(text).toContain(`250 2.0.0 Ok: queued as ${record.messageIds[0]}`)
      expect(text).not.toContain(account.pass)
      expect(text).not.toContain(Buffer.from(account.pass).toString('base64'))
      expect(text).not.toContain(Buffer.from(account.user).toString('base64'))
    }
  })

  it('records a failed AUTH as auth_failed with the 535 reply', async () => {
    const account = await createSmtpAccount(ctx.db)
    env = await startTestServer(ctx.db)
    const transport = env.transport({ user: account.user, pass: 'wrong' })
    await transport.verify().catch(() => {})
    transport.close()
    await expect.poll(() => env?.records.length).toBe(1)
    expect(env.records[0]).toMatchObject({
      workspaceId: null,
      authUser: account.user,
      outcome: 'auth_failed',
      error: '535 5.7.8 Authentication credentials invalid',
    })
  })

  it('does not offer STARTTLS without a certificate', async () => {
    const account = await createSmtpAccount(ctx.db)
    env = await startTestServer(ctx.db)
    const transport = env.transport(account, { ignoreTLS: false, requireTLS: true })
    await expect(transport.verify()).rejects.toThrow()
    transport.close()
  })

  const tls = selfSigned()
  it.skipIf(!tls)('upgrades with STARTTLS when a certificate is configured', async () => {
    const account = await createSmtpAccount(ctx.db)
    env = await startTestServer(ctx.db, { tls: tls ?? undefined })
    const transport = env.transport(account, {
      ignoreTLS: false,
      requireTLS: true,
      tls: { rejectUnauthorized: false },
    })
    await transport.sendMail(mail)
    transport.close()
    await expect.poll(() => env?.records.length).toBe(1)
    expect(env.records[0]).toMatchObject({ secure: true, outcome: 'accepted' })
  })
})
