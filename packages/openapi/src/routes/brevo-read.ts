import {
  BrevoBlockedContactParams,
  BrevoBlockedContactsQuery,
  BrevoBlockedContactsResponse,
  BrevoListEmailsQuery,
  BrevoListEmailsResponse,
} from '@mailsink/contracts'
import type { RouteSpec } from '../route'

const brevo = { tag: 'Brevo', auth: 'brevo', errorDialect: 'brevo', ingestion: true } as const

/** Brevo read routes of a `brevo` connection (#149, propositions D275, D276). */
export const BREVO_READ_ROUTES: RouteSpec[] = [
  {
    ...brevo,
    operationId: 'brevoListEmails',
    method: 'get',
    path: '/v3/smtp/emails',
    summary: 'Brevo: the transactional emails sent by the connection',
    description:
      'One item per message and recipient. `email`, `templateId` or `messageId` is required; `startDate` and `endDate` (YYYY-MM-DD, UTC) go together and span at most one month, the past 30 days by default.',
    query: BrevoListEmailsQuery,
    success: [{ status: 200, description: 'A page.', schema: BrevoListEmailsResponse }],
  },
  {
    ...brevo,
    operationId: 'brevoListBlockedContacts',
    method: 'get',
    path: '/v3/smtp/blockedContacts',
    summary: 'Brevo: the suppression list of the workspace as blocked contacts',
    query: BrevoBlockedContactsQuery,
    success: [{ status: 200, description: 'A page.', schema: BrevoBlockedContactsResponse }],
  },
  {
    ...brevo,
    operationId: 'brevoUnblockContact',
    method: 'delete',
    path: '/v3/smtp/blockedContacts/{email}',
    summary: 'Brevo: remove an address from the suppression list',
    params: BrevoBlockedContactParams,
    success: [{ status: 204, description: 'Unblocked.' }],
    errors: ['not_found'],
  },
]
