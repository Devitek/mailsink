// Test harness of the SMTP contract tests: an smtp account and a server with spies.
import { randomBytes } from 'node:crypto'
import { createConnection } from 'node:net'
import { createEventBus, createRateLimiter, hashSmtpPassword } from '@mailsink/core'
import type { Database } from '@mailsink/db'
import { createTestConnection, createTestWorkspace } from '@mailsink/db/testing'
import { createTransport } from 'nodemailer'
import type SMTPTransport from 'nodemailer/lib/smtp-transport'
import { createCredentialCache } from './credential-cache'
import { type SmtpServerHandle, type SmtpServerOptions, startSmtpServer } from './server'
import type { SmtpSessionRecord } from './session-record'

export interface SmtpAccount {
  workspaceId: string
  connectionId: string
  user: string
  pass: string
}

/** A workspace with one `smtp` connection and its credentials. */
export async function createSmtpAccount(
  db: Database,
  workspace: Parameters<typeof createTestWorkspace>[1] = {},
): Promise<SmtpAccount> {
  const pass = randomBytes(12).toString('base64url')
  const ws = await createTestWorkspace(db, workspace)
  const user = `smtp-${randomBytes(4).toString('hex')}`
  const connection = await createTestConnection(db, ws.id, {
    name: 'SMTP',
    kind: 'smtp',
    smtpUsername: user,
    smtpPasswordHash: await hashSmtpPassword(pass),
  })
  return { workspaceId: ws.id, connectionId: connection.id, user, pass }
}

/** A started server with spies on what it publishes, touches and records. */
export async function startTestServer(db: Database, patch: Partial<SmtpServerOptions> = {}) {
  const bus = createEventBus()
  const touched: string[] = []
  const records: SmtpSessionRecord[] = []
  const credentialCache = createCredentialCache()
  const server: SmtpServerHandle = await startSmtpServer({
    port: 0,
    host: '127.0.0.1',
    db,
    bus,
    activity: { touch: async (id) => void touched.push(id) },
    rateLimiter: createRateLimiter(),
    random: () => 0.5,
    maxMessageBytes: 1024 * 1024,
    recordSmtpSession: (record) => void records.push(record),
    credentialCache,
    log: { info: () => {}, warn: () => {}, error: () => {} },
    closeTimeoutMs: 500,
    ...patch,
  })
  const transport = (
    auth: { user: string; pass: string } | null,
    extra: SMTPTransport.Options = {},
  ) =>
    createTransport({
      host: '127.0.0.1',
      port: server.port,
      secure: false,
      ignoreTLS: true,
      ...(auth ? { auth } : {}),
      ...extra,
    })
  return { server, bus, touched, records, credentialCache, transport }
}

/**
 * Raw SMTP dialogue: sends each command after the previous reply and answers the last
 * line of every reply, the greeting first.
 */
export async function smtpDialogue(port: number, commands: string[]): Promise<string[]> {
  const socket = createConnection({ port, host: '127.0.0.1' })
  const replies: string[] = []
  let buffer = ''
  let waiting: ((line: string) => void) | undefined
  const pending: string[] = []
  socket.on('data', (chunk) => {
    buffer += chunk.toString()
    let end = buffer.indexOf('\r\n')
    while (end >= 0) {
      const line = buffer.slice(0, end)
      buffer = buffer.slice(end + 2)
      if (/^\d{3} /.test(line)) {
        if (waiting) {
          const resolve = waiting
          waiting = undefined
          resolve(line)
        } else pending.push(line)
      }
      end = buffer.indexOf('\r\n')
    }
  })
  const next = () =>
    new Promise<string>((resolve) => {
      const line = pending.shift()
      if (line !== undefined) resolve(line)
      else waiting = resolve
    })
  replies.push(await next())
  for (const command of commands) {
    socket.write(`${command}\r\n`)
    replies.push(await next())
  }
  socket.destroy()
  return replies
}
