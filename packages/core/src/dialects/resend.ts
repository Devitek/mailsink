import {
  issueCode,
  RESEND_ADDRESS_HINT,
  type ResendErrorName,
  ResendSendRequest,
} from '@mailsink/contracts'
import { DomainError } from '../errors'
import type { NormalizedEmail } from '../ingestion/normalize'

/** A refused Resend request: the name, status and message Resend would answer. */
export interface ResendIssue {
  name: ResendErrorName
  status: number
  message: string
}

type ZodError = NonNullable<ReturnType<typeof ResendSendRequest.safeParse>['error']>
type ZodIssue = ZodError['issues'][number]

/** Fields whose absence is a `missing_required_field` (422), as Resend. */
const REQUIRED = ['from', 'to', 'subject'] as const

/** Contract refinements answered with their own name and status instead of 400. */
const REFINEMENTS: Record<string, Pick<ResendIssue, 'name' | 'status'>> = {
  to_required: { name: 'missing_required_field', status: 422 },
  html_or_text_required: { name: 'missing_required_field', status: 422 },
  attachment_content_required: { name: 'invalid_attachment', status: 422 },
  attachment_path_unsupported: { name: 'invalid_attachment', status: 422 },
}

const fieldOf = (path: readonly PropertyKey[]) =>
  path.reduce<string>(
    (out, key) =>
      typeof key === 'number' ? `${out}[${key}]` : out ? `${out}.${String(key)}` : String(key),
    '',
  )

/** Message of a nested custom issue (union branches included), if any. */
function detailOf(issue: ZodIssue): string | undefined {
  if (issue.code === 'custom') return issue.message
  if (issue.code === 'invalid_format' || issue.code === 'too_big' || issue.code === 'too_small') {
    return issue.message
  }
  if (issue.code === 'invalid_union') {
    for (const branch of issue.errors)
      for (const nested of branch) {
        const found = detailOf(nested)
        if (found) return found
      }
  }
  return undefined
}

function toIssue(input: unknown, error: ZodError): ResendIssue {
  const body = input && typeof input === 'object' ? (input as Record<string, unknown>) : {}
  const missing = REQUIRED.find((field) => body[field] === undefined || body[field] === null)
  if (missing) {
    return { name: 'missing_required_field', status: 422, message: `Missing \`${missing}\` field.` }
  }
  const first = error.issues[0]
  if (!first) return { name: 'validation_error', status: 400, message: 'Invalid request body.' }
  const code = issueCode(first)
  const refinement = code ? REFINEMENTS[code] : undefined
  if (refinement) return { ...refinement, message: first.message }
  if (code === 'template_unsupported' || code === 'too_many_recipients') {
    return { name: 'validation_error', status: 400, message: first.message }
  }
  let detail = detailOf(first)
  if (code === 'invalid_address' || (first.code === 'invalid_union' && detail === undefined)) {
    detail ??= RESEND_ADDRESS_HINT
  }
  const field = fieldOf(first.path)
  const head = field ? `Invalid \`${field}\` field.` : 'Invalid request body.'
  return { name: 'validation_error', status: 400, message: detail ? `${head} ${detail}` : head }
}

export type ResendParse = { ok: true; data: ResendSendRequest } | { ok: false; issue: ResendIssue }

/**
 * Validates one Resend email (`POST /emails` body or a batch item) and words the first
 * problem as Resend does (`Missing \`to\` field.`, `Invalid \`from\` field. …`). In a batch,
 * `attachments` is refused as Resend does.
 */
export function parseResendEmail(input: unknown, options: { batch?: boolean } = {}): ResendParse {
  if (options.batch && input && typeof input === 'object' && 'attachments' in input) {
    return {
      ok: false,
      issue: {
        name: 'validation_error',
        status: 400,
        message: 'The `attachments` field is not supported for batch emails.',
      },
    }
  }
  const result = ResendSendRequest.safeParse(input, { reportInput: false })
  return result.success
    ? { ok: true, data: result.data }
    : { ok: false, issue: toIssue(input, result.error) }
}

/**
 * A request refused by the Resend dialect: a `validation_error` with the Resend status, and
 * the Resend name in `details.resend` (read by the dialect's error formatter).
 */
export function resendError(issue: ResendIssue): DomainError {
  return new DomainError('validation_error', issue.message, {
    status: issue.status,
    details: { resend: issue.name },
  })
}

/** Resend request (already validated) to NormalizedEmail. */
export function fromResendRequest(request: ResendSendRequest): NormalizedEmail {
  return {
    from: request.from,
    to: request.to,
    cc: request.cc ?? [],
    bcc: request.bcc ?? [],
    replyTo: request.reply_to ?? request.replyTo ?? [],
    subject: request.subject,
    html: request.html ?? null,
    text: request.text ?? null,
    headers: request.headers ?? {},
    tags: request.tags ?? [],
    metadata: null,
    attachments: (request.attachments ?? []).map((a) => ({
      filename: a.filename ?? null,
      content: new Uint8Array(Buffer.from(a.content ?? '', 'base64')),
      ...(a.content_type ? { contentType: a.content_type } : {}),
      ...(a.content_id ? { contentId: a.content_id } : {}),
    })),
  }
}
