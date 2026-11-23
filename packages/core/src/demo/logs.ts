import type { Address, TranscriptLine } from '@mailsink/contracts'
import { type Executor, insertApiLog, insertSmtpSession, newId } from '@mailsink/db'
import type { StreamFrame } from '../events/bus'
import type { IngestTarget, NormalizedEmail } from '../ingestion/normalize'
import type { IngestedMessage } from '../ingestion/pipeline'
import { toApiLogSummary, toSmtpSessionSummary } from '../logs/views'

// The log line of a demo message (#118): the request (or SMTP session) that would have
// created it through its connection, so the « See in the logs » link of the viewer and the
// logs explorer work on the demo data too. Bodies are the payload of the dialect, with
// attachment contents stripped like the real request log does.

export interface DemoLogInput {
  target: IngestTarget
  email: NormalizedEmail
  message: IngestedMessage
  createdAt: Date
}

const USER_AGENT = 'mailsink-demo'
const DURATION_MS = 42

const display = (a: Address) => (a.name ? `${a.name} <${a.email}>` : a.email)
const emails = (list: readonly Address[]) => list.map((a) => a.email)
const files = (email: NormalizedEmail) =>
  email.attachments.length > 0
    ? email.attachments.map((a) => ({ filename: a.filename, content: '[stripped]' }))
    : undefined

function resendLike(email: NormalizedEmail) {
  return {
    from: display(email.from),
    to: emails(email.to),
    cc: email.cc.length > 0 ? emails(email.cc) : undefined,
    subject: email.subject,
    html: email.html ?? undefined,
    text: email.text ?? undefined,
    tags: email.tags.length > 0 ? email.tags : undefined,
    attachments: files(email),
  }
}

function brevo(email: NormalizedEmail) {
  const contact = (a: Address) => (a.name ? { email: a.email, name: a.name } : { email: a.email })
  return {
    sender: contact(email.from),
    to: email.to.map(contact),
    cc: email.cc.length > 0 ? email.cc.map(contact) : undefined,
    subject: email.subject,
    htmlContent: email.html ?? undefined,
    textContent: email.text ?? undefined,
    tags: email.tags.length > 0 ? email.tags.map((t) => t.value) : undefined,
    attachment: email.attachments.length > 0 ? files(email) : undefined,
  }
}

/** Method, path, status, request and response bodies of the dialect of `source`. */
function exchange({ target, email, message }: DemoLogInput) {
  if (target.source === 'brevo') {
    return {
      path: '/v3/smtp/email',
      statusCode: 201,
      requestBody: brevo(email),
      responseBody: { messageId: message.providerMessageId },
    }
  }
  if (target.source === 'resend') {
    return {
      path: '/emails',
      statusCode: 200,
      requestBody: resendLike(email),
      responseBody: { id: message.providerMessageId },
    }
  }
  return {
    path: '/v1/emails',
    statusCode: 200,
    requestBody: resendLike(email),
    responseBody: { id: message.id, status: message.status },
  }
}

function transcript({ email, message, createdAt }: DemoLogInput): TranscriptLine[] {
  const at = createdAt.getTime()
  const rcpt = [...email.to, ...email.cc, ...email.bcc].map((a) => `RCPT TO:<${a.email}>`)
  const client = ['EHLO demo.fieldnote.example', `MAIL FROM:<${email.from.email}>`, ...rcpt]
  return [
    { at, dir: 'S', line: '220 mailsink ESMTP' },
    ...client.flatMap((line) => [
      { at, dir: 'C' as const, line },
      { at, dir: 'S' as const, line: '250 OK' },
    ]),
    { at, dir: 'C', line: 'DATA' },
    { at, dir: 'S', line: '354 End data with <CR><LF>.<CR><LF>' },
    { at, dir: 'C', line: '<message data>' },
    { at, dir: 'S', line: `250 OK: queued as ${message.id}` },
    { at, dir: 'C', line: 'QUIT' },
    { at, dir: 'S', line: '221 Bye' },
  ]
}

/** Writes the log row of one demo message in `tx`; returns its `log.*` stream frame. */
export async function writeDemoLog(tx: Executor, input: DemoLogInput): Promise<StreamFrame> {
  const { target, createdAt } = input
  const messageIds = [input.message.id]
  if (target.source === 'smtp') {
    const row = await insertSmtpSession(tx, {
      id: newId('smtp'),
      workspaceId: target.workspaceId,
      connectionId: target.connectionId,
      remoteAddress: '127.0.0.1',
      clientHostname: 'demo.fieldnote.example',
      authUser: null,
      secure: false,
      transcript: transcript(input),
      messageIds,
      outcome: 'accepted',
      error: null,
      startedAt: createdAt,
      endedAt: new Date(createdAt.getTime() + DURATION_MS),
    })
    const session = toSmtpSessionSummary(row)
    return { id: null, connectionId: row.connectionId, event: { type: 'log.smtp', session } }
  }
  const row = await insertApiLog(tx, {
    id: newId('req'),
    workspaceId: target.workspaceId,
    connectionId: target.connectionId,
    dialect: target.source,
    method: 'POST',
    durationMs: DURATION_MS,
    requestHeaders: { 'content-type': 'application/json', 'user-agent': USER_AGENT },
    responseHeaders: { 'content-type': 'application/json' },
    messageIds,
    ip: null,
    createdAt,
    ...exchange(input),
  })
  return {
    id: null,
    connectionId: row.connectionId,
    event: { type: 'log.api', log: toApiLogSummary(row) },
  }
}
