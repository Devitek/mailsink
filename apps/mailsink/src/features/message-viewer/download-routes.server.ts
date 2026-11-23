import { getCapturedMessage, isDomainError, readAttachment, readRawMessage } from '@mailsink/core'
import { binaryResponse, contentDisposition, safeContentType } from '../../http/capture/download'
import { notFound, sessionWorkspace } from '../inbox/session-workspace.server'
import type { PreviewScheme } from '../inbox/ui-paths'
import { dataUrl, INLINE_IMAGES_MAX_BYTES, PREVIEW_CSP, previewDocument } from './preview-document'

// Session routes of the message viewer (#40): the Capture downloads (raw EML, attachments)
// and the HTML preview, with the headers of the Capture downloads (captured content is
// untrusted and served from the app origin).

async function guarded(
  slug: string,
  run: (ctx: {
    db: Parameters<typeof readRawMessage>[0]
    workspaceId: string
  }) => Promise<Response>,
): Promise<Response> {
  const resolved = await sessionWorkspace(slug)
  if (resolved instanceof Response) return resolved
  try {
    return await run({ db: resolved.runtime.db.db, workspaceId: resolved.workspace.id })
  } catch (error) {
    if (isDomainError(error) && error.code === 'not_found') return notFound(error.message)
    throw error
  }
}

/** `GET /w/$workspaceSlug/m/$messageId/raw`: the MIME source as an `.eml` download. */
export const rawForSession = (slug: string, messageId: string) =>
  guarded(slug, async ({ db, workspaceId }) =>
    binaryResponse(await readRawMessage(db, workspaceId, messageId), {
      contentType: 'message/rfc822',
      disposition: contentDisposition('attachment', `${messageId}.eml`),
    }),
  )

/** `GET /w/$workspaceSlug/m/$messageId/attachments/$attachmentId`, always as a download. */
export const attachmentForSession = (slug: string, messageId: string, attachmentId: string) =>
  guarded(slug, async ({ db, workspaceId }) => {
    const found = await readAttachment(db, workspaceId, messageId, attachmentId)
    return binaryResponse(found.data, {
      contentType: safeContentType(found.contentType),
      disposition: contentDisposition('attachment', found.filename),
    })
  })

/** `GET /w/$workspaceSlug/m/$messageId/html?scheme=`: the document of the preview iframe. */
export const htmlForSession = (slug: string, messageId: string, scheme: PreviewScheme) =>
  guarded(slug, async ({ db, workspaceId }) => {
    const message = await getCapturedMessage(db, workspaceId, messageId)
    if (message.html === null) return notFound('This message has no HTML body')
    const inline: Record<string, string> = {}
    let budget = INLINE_IMAGES_MAX_BYTES
    for (const part of message.attachments) {
      if (!part.contentId || !part.contentType.startsWith('image/') || part.sizeBytes > budget) {
        continue
      }
      const found = await readAttachment(db, workspaceId, messageId, part.id)
      budget -= found.data.byteLength
      const mediaType = safeContentType(part.contentType).split(';')[0]?.trim() ?? 'image/png'
      inline[part.contentId] = dataUrl(mediaType, found.data)
    }
    const body = previewDocument(message.html, { scheme, inline })
    return new Response(body, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': PREVIEW_CSP,
        'Cache-Control': 'private, no-store',
        'Referrer-Policy': 'no-referrer',
      },
    })
  })
