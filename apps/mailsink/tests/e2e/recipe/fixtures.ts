import { test as base, type MailsinkWorkspaceOptions } from '@devitek/mailsink-playwright'
import { Resend } from 'resend'
import { ADMIN_KEY, BASE_URL } from '../web-server'

// The fixture file of docs/guides/e2e.md: @devitek/mailsink-playwright gives every worker
// an ephemeral workspace and every test a `mailsink` client reset before it starts; `app`
// stands for the application under test.

/** Where the workspaces are created; a file asking for other connections spreads it. */
export const mailsinkOptions: MailsinkWorkspaceOptions = { url: BASE_URL, adminKey: ADMIN_KEY }

export interface SentEmail {
  to: string
  subject: string
  html?: string
  text?: string
  attachments?: { filename: string; content: string }[]
}

export interface App {
  /** Sends one email the way the application does; resolves the Mailsink message id. */
  send(email: SentEmail): Promise<string>
}

export const test = base.extend<{ app: App }>({
  mailsinkOptions: [mailsinkOptions, { scope: 'worker' }],
  // The application under test sends with the official Resend SDK, configured from the
  // `.env` of the worker's workspace: RESEND_API_KEY and RESEND_BASE_URL.
  app: async ({ mailsinkWorkspace }, use) => {
    const { RESEND_API_KEY, RESEND_BASE_URL } = mailsinkWorkspace.env
    const resend = new Resend(RESEND_API_KEY, { baseUrl: RESEND_BASE_URL })
    await use({
      async send(email) {
        const { data, error } = await resend.emails.send({
          from: 'Acme <hello@acme.test>',
          ...email,
        } as Parameters<typeof resend.emails.send>[0])
        if (error) throw new Error(`send: ${error.name} ${error.message}`)
        return `msg_${data?.id}`
      },
    })
  },
})

export { expect, getCode, getLink, openLink } from '@devitek/mailsink-playwright'
// Kept for the UI scenarios that create their own workspaces.
export { adminContext, createWorkspace, deleteWorkspace, type E2eWorkspace } from './api-context'
