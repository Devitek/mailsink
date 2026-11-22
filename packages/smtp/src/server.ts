import type { AddressInfo } from 'node:net'
import { SMTPServer, type SMTPServerDataStream } from 'smtp-server'

/** A message accepted by the listener. Parsing and storage come with the ingestion issue. */
export type ReceivedMessage = {
  from: string | null
  to: string[]
  raw: Buffer
}

export type SmtpListenerOptions = {
  port: number
  host?: string
  onMessage: (message: ReceivedMessage) => void | Promise<void>
  /** Max time to wait for open sessions on close (smtp-server defaults to 30 s). */
  closeTimeoutMs?: number
}

export type SmtpListener = {
  /** Bound port (useful when `port: 0` asked for an ephemeral one). */
  port: number
  close: () => Promise<void>
}

async function readAll(stream: SMTPServerDataStream): Promise<Buffer> {
  const chunks: Buffer[] = []
  for await (const chunk of stream) chunks.push(chunk as Buffer)
  return Buffer.concat(chunks)
}

/** Starts a no-auth SMTP listener (spike for D3). Resolves once the socket is bound. */
export function startSmtpListener(options: SmtpListenerOptions): Promise<SmtpListener> {
  const server = new SMTPServer({
    authOptional: true,
    disabledCommands: ['AUTH', 'STARTTLS'],
    logger: false,
    closeTimeout: options.closeTimeoutMs ?? 5_000,
    onData(stream, session, callback) {
      readAll(stream)
        .then((raw) =>
          options.onMessage({
            from: session.envelope.mailFrom ? session.envelope.mailFrom.address : null,
            to: session.envelope.rcptTo.map((rcpt) => rcpt.address),
            raw,
          }),
        )
        .then(() => callback(), callback)
    },
  })

  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(options.port, options.host, () => {
      server.off('error', reject)
      const { port } = server.server.address() as AddressInfo
      resolve({
        port,
        close: () => new Promise<void>((done) => server.close(() => done())),
      })
    })
  })
}
