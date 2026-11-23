import {
  BatchResponse,
  BrevoSendRequest,
  BrevoSendResponse,
  MAX_BATCH_SIZE,
  RESEND_MAX_BATCH_SIZE,
  ResendBatchResponse,
  ResendBatchValidation,
  ResendEmail,
  ResendSendRequest,
  ResendSendResponse,
  SendEmailRequest,
  SendEmailResponse,
} from '@mailsink/contracts'
import { z } from 'zod'
import { IDEMPOTENCY_KEY } from '../headers'
import type { RouteSpec } from '../route'

const native = { tag: 'Native ingestion', auth: 'connection', ingestion: true } as const
const resend = { tag: 'Resend', auth: 'connection', errorDialect: 'resend' } as const

/** Ingestion: native `/v1`, Resend and Brevo drop-ins (rate limit and chaos, D90). */
export const INGESTION_ROUTES: RouteSpec[] = [
  {
    ...native,
    operationId: 'sendEmail',
    method: 'post',
    path: '/v1/emails',
    summary: 'Send one email (any connection kind)',
    headers: IDEMPOTENCY_KEY,
    body: SendEmailRequest,
    success: [{ status: 200, description: 'Accepted.', schema: SendEmailResponse }],
  },
  {
    ...native,
    operationId: 'sendEmailBatch',
    method: 'post',
    path: '/v1/emails/batch',
    summary: 'Send a batch, items validated one by one (D33)',
    description: '`200` when every item is accepted, `207` otherwise (also when none is).',
    headers: IDEMPOTENCY_KEY,
    body: z.array(SendEmailRequest).min(1).max(MAX_BATCH_SIZE),
    success: [
      { status: 200, description: 'Every item accepted.', schema: BatchResponse },
      { status: 207, description: 'Some or no item accepted.', schema: BatchResponse },
    ],
  },
  {
    ...resend,
    ingestion: true,
    operationId: 'resendSendEmail',
    method: 'post',
    path: '/emails',
    summary: 'Resend: send an email (`resend` connection)',
    headers: IDEMPOTENCY_KEY,
    body: ResendSendRequest,
    success: [{ status: 200, description: 'Accepted.', schema: ResendSendResponse }],
  },
  {
    ...resend,
    ingestion: true,
    operationId: 'resendSendBatch',
    method: 'post',
    path: '/emails/batch',
    summary: 'Resend: send a batch (`strict` all or nothing, or `permissive`)',
    headers: IDEMPOTENCY_KEY.extend({
      'x-batch-validation': ResendBatchValidation.optional().meta({
        description: '`strict` (default) or `permissive`.',
      }),
    }),
    body: z.array(ResendSendRequest).min(1).max(RESEND_MAX_BATCH_SIZE),
    success: [{ status: 200, description: 'Accepted.', schema: ResendBatchResponse }],
  },
  {
    ...resend,
    operationId: 'resendGetEmail',
    method: 'get',
    path: '/emails/{id}',
    summary: 'Resend: a message of the workspace by its id',
    params: z.object({ id: z.string() }),
    success: [{ status: 200, description: 'The email.', schema: ResendEmail }],
  },
  {
    tag: 'Brevo',
    auth: 'brevo',
    errorDialect: 'brevo',
    ingestion: true,
    operationId: 'brevoSendEmail',
    method: 'post',
    path: '/v3/smtp/email',
    summary: 'Brevo: send a transactional email (`brevo` connection)',
    description:
      'The idempotency key is the `Idempotency-Key` header, else the `IdempotencyKey` entry of the `headers` body field.',
    headers: IDEMPOTENCY_KEY,
    body: BrevoSendRequest,
    success: [{ status: 201, description: 'Accepted.', schema: BrevoSendResponse }],
  },
]
