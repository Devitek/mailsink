import type { BrevoMessageVersion, BrevoSendRequest } from '@mailsink/contracts'
import type { Template } from '@mailsink/db'
import { DomainError } from '../../errors'
import type { NormalizedEmail } from '../../ingestion/normalize'
import { renderTemplate } from '../../templates/render'

/** Name of the Mailsink tag each Brevo tag string becomes (`{ name: 'tag', value }`). */
export const BREVO_TAG_NAME = 'tag'

/** A 400 `validation_error` on one body field, as the parser would raise it. */
export function brevoFieldError(field: string, code: string, message: string): DomainError {
  return new DomainError('validation_error', message, {
    status: 400,
    details: {
      in: 'body',
      issues: [{ path: [field], code: 'custom', message, params: { code } }],
    },
  })
}

type Version = Partial<BrevoMessageVersion> & Pick<BrevoMessageVersion, 'to'>

function metadataOf(request: BrevoSendRequest): Record<string, unknown> | null {
  const urls = (request.attachment ?? []).flatMap((a) =>
    a.content === undefined && a.url ? [{ url: a.url, name: a.name ?? null }] : [],
  )
  const brevo = {
    ...(request.scheduledAt ? { scheduledAt: request.scheduledAt } : {}),
    ...(request.batchId ? { batchId: request.batchId } : {}),
    ...(urls.length > 0 ? { attachmentUrls: urls } : {}),
  }
  return Object.keys(brevo).length > 0 ? { brevo } : null
}

/**
 * Brevo `POST /v3/smtp/email` (validated) to one NormalizedEmail per message version, or a
 * single one without `messageVersions`. With a template, its subject (unless the request
 * sets one), sender (idem), html and text are used; the request bodies are ignored, as
 * Brevo does. Version params override the global ones; `{{ params.x }}` and
 * `{{ contact.X }}` are rendered in the subject and both bodies (`contact.EMAIL` = the
 * first `to` address, other contact attributes render empty).
 */
export function fromBrevoRequest(
  request: BrevoSendRequest,
  template: Template | null,
): NormalizedEmail[] {
  const from = request.sender ?? template?.sender ?? undefined
  if (!from) throw brevoFieldError('sender', 'sender_required', 'sender is missing')
  const versions: Version[] = request.messageVersions ?? [{ to: request.to ?? [] }]
  const metadata = metadataOf(request)
  const attachments = (request.attachment ?? []).flatMap((a) =>
    a.content === undefined
      ? []
      : [{ filename: a.name ?? null, content: new Uint8Array(Buffer.from(a.content, 'base64')) }],
  )
  return versions.map((version) => {
    const params = { ...request.params, ...version.params }
    const contact = { EMAIL: version.to[0]?.email ?? '' }
    const render = (source: string | null | undefined, html = false) =>
      source ? renderTemplate(source, { params, contact }, { html }) : null
    const subject = version.subject ?? request.subject ?? template?.subject ?? ''
    const html = template ? template.html : (version.htmlContent ?? request.htmlContent)
    const text = template ? template.text : (version.textContent ?? request.textContent)
    const replyTo = version.replyTo ?? request.replyTo
    return {
      from,
      to: version.to,
      cc: version.cc ?? request.cc ?? [],
      bcc: version.bcc ?? request.bcc ?? [],
      replyTo: replyTo ? [replyTo] : [],
      subject: render(subject) ?? '',
      html: render(html, true),
      text: render(text),
      headers: request.headers ?? {},
      tags: (request.tags ?? []).map((value) => ({ name: BREVO_TAG_NAME, value })),
      metadata,
      attachments,
      ...(template ? { templateRef: { templateId: template.externalId, params } } : {}),
    } satisfies NormalizedEmail
  })
}
