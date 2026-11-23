import type { MessageDetail } from '@mailsink/contracts'

// Shapes the inbox server functions return (serialisable).

/**
 * What the viewer shows of a `MessageDetail`: free-form `metadata` and the `simulation`
 * snapshot are left out (not shown, and not serializable as typed).
 */
export type ViewerMessage = Omit<MessageDetail, 'metadata' | 'simulation'>

/** The MIME source as text, cut for the page (the download keeps every byte). */
export type RawSource = { text: string; sizeBytes: number; truncated: boolean }

/**
 * Where a message came from, for the « Payload / Source EML » toggle of the viewer: the
 * logged API request that created it (body as received, attachments stripped), or the SMTP
 * envelope of its session. Null when no log holds it any more (retention, purge).
 */
export type MessageOrigin =
  | {
      kind: 'api'
      logId: string
      dialect: string
      method: string
      path: string
      statusCode: number
      createdAt: string
      /** JSON text of the request body, pretty printed; null when not logged. */
      body: string | null
    }
  | {
      kind: 'smtp'
      sessionId: string
      startedAt: string
      /** Client commands of the envelope (EHLO, MAIL FROM, RCPT TO). */
      envelope: string[]
    }
