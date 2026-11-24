import {
  BrevoBlockedContactParams,
  BrevoBlockedContactsQuery,
  BrevoListEmailsQuery,
} from '@mailsink/contracts'
import { listBrevoBlockedContacts, listBrevoEmails, unblockBrevoContact } from '@mailsink/core'
import { z } from 'zod'
import { defineApi } from '../../handler'
import { queryObject } from '../../validation'
import { brevoErrorBody } from './errors'
import { BREVO_EXTENSIONS, parseBrevoInput } from './route'

// Brevo read routes of a `brevo` connection (#149, D275, D276).

const common = {
  auth: 'connection',
  errorFormat: brevoErrorBody,
  extensions: BREVO_EXTENSIONS,
} as const

const queryOf = (request: Request) => queryObject(new URL(request.url))

/** `GET /v3/smtp/emails`: the copies sent through the calling connection. */
export const getBrevoEmails = defineApi({
  ...common,
  handler: async ({ request, runtime, auth }) =>
    listBrevoEmails(
      runtime.db.db,
      { workspaceId: auth.workspace.id, connectionId: auth.connection.id },
      await parseBrevoInput(BrevoListEmailsQuery, queryOf(request), 'query'),
      { timeZone: auth.workspace.timezone },
    ),
})

/** `GET /v3/smtp/blockedContacts`: the workspace suppression list (D75). */
export const getBrevoBlockedContacts = defineApi({
  ...common,
  handler: async ({ request, runtime, auth }) =>
    listBrevoBlockedContacts(
      runtime.db.db,
      auth.workspace.id,
      await parseBrevoInput(BrevoBlockedContactsQuery, queryOf(request), 'query'),
      { timeZone: auth.workspace.timezone },
    ),
})

const decoded = (value: string | undefined) => {
  try {
    return decodeURIComponent(value ?? '')
  } catch {
    return value ?? ''
  }
}

/** `DELETE /v3/smtp/blockedContacts/{email}`: 204, or 404 when the address is not listed. */
export const deleteBrevoBlockedContact = defineApi({
  ...common,
  params: z.object({ email: z.string() }), // validated below, so a bad address is a 400
  handler: async ({ runtime, auth, params }) => {
    const { email } = await parseBrevoInput(
      BrevoBlockedContactParams,
      { email: decoded(params.email) },
      'params',
    )
    await unblockBrevoContact(runtime.db.db, auth.workspace.id, email)
    return new Response(null, { status: 204 })
  },
})
