import type { Address } from '@mailsink/contracts'

export type MessageSource = 'native' | 'resend' | 'brevo' | 'smtp'

export interface NormalizedAttachment {
  filename: string | null
  /** Detected from the filename by the pipeline when absent. */
  contentType?: string
  /** Inline `cid:`; an attachment with a content id is inline. */
  contentId?: string
  content: Uint8Array
}

/**
 * The one input of the ingestion pipeline: every dialect (native, Resend, Brevo, SMTP) maps
 * its request to this shape (03-contracts, « Native ingestion »). Addresses are lower-cased.
 */
export interface NormalizedEmail {
  from: Address
  to: Address[]
  cc: Address[]
  bcc: Address[]
  replyTo: Address[]
  subject: string
  html: string | null
  text: string | null
  headers: Record<string, string>
  tags: { name: string; value: string }[]
  metadata: Record<string, unknown> | null
  attachments: NormalizedAttachment[]
  /** Raw MIME as received (SMTP); composed with MailComposer otherwise (D9). */
  raw?: Uint8Array
  /** Id the emulated provider returns (Resend uuid, Brevo `<…@…>`); the message id otherwise. */
  providerMessageId?: string
  templateRef?: { templateId: number; params: Record<string, unknown> }
}

/** Where a message comes from: the authenticated workspace and connection. */
export interface IngestTarget {
  workspaceId: string
  /** Null when no connection is involved (never for the HTTP dialects). */
  connectionId: string | null
  source: MessageSource
}
