import { BrevoClient } from '@getbrevo/brevo'
import { BASE_URL } from '../web-server'
import { expect, getLink, mailsinkOptions, test } from './fixtures'

// docs/guides/e2e.md, « Sending with the Brevo SDK »: this file's workers get a `brevo`
// connection seeded with the templates of the app; the official SDK is pointed at Mailsink.

test.use({
  mailsinkOptions: {
    ...mailsinkOptions,
    connections: [{ kind: 'brevo', name: 'app' }],
    workspace: {
      simulation: { rules: [{ match: '*+bounce@*', status: 'hard_bounce', smtpCode: 550 }] },
    },
    templates: [
      {
        externalId: 12,
        name: 'Reset',
        subject: 'Reset for {{ params.name }}',
        html: '<p>Hi {{ params.name }}, <a href="{{ params.url }}">reset</a></p>',
        sender: { email: 'support@acme.test', name: 'Support' },
      },
    ],
  },
})

test('the Brevo SDK sends a template, captured rendered with its links', async ({
  mailsinkWorkspace,
  expectEmail,
}) => {
  const { BREVO_API_KEY, BREVO_BASE_URL } = mailsinkWorkspace.env
  expect(BREVO_BASE_URL).toBe(`${BASE_URL}/v3`)

  // What the application does, unchanged but for its two environment variables.
  const brevo = new BrevoClient({ apiKey: BREVO_API_KEY, baseUrl: BREVO_BASE_URL, maxRetries: 0 })
  const sent = await brevo.transactionalEmails.sendTransacEmail({
    templateId: 12,
    to: [{ email: 'jane@example.com' }],
    params: { name: 'Jane', url: 'https://app.acme.test/reset?t=1' },
  })
  expect(sent.messageId).toMatch(/^<.+@.+>$/)

  const email = await expectEmail({ to: 'jane@example.com', status: 'delivered' })
  expect(email).toMatchObject({ subject: 'Reset for Jane', source: 'brevo' })
  expect(email.from).toMatchObject({ email: 'support@acme.test' })
  expect(getLink(email, '/reset')).toBe('https://app.acme.test/reset?t=1')
})

test('the Brevo SDK reads back its sends and the blocked contacts', async ({
  mailsinkWorkspace,
  expectEmail,
}) => {
  const { BREVO_API_KEY, BREVO_BASE_URL } = mailsinkWorkspace.env
  const brevo = new BrevoClient({ apiKey: BREVO_API_KEY, baseUrl: BREVO_BASE_URL, maxRetries: 0 })
  const sent = await brevo.transactionalEmails.sendTransacEmail({
    templateId: 12,
    to: [{ email: 'sam+bounce@example.com' }],
    params: { name: 'Sam', url: 'https://app.acme.test/reset?t=2' },
  })
  await expectEmail({ to: 'sam+bounce@example.com', status: 'hard_bounce' })

  const list = await brevo.transactionalEmails.getTransacEmailsList({ templateId: 12 })
  expect(list.transactionalEmails).toContainEqual(
    expect.objectContaining({ email: 'sam+bounce@example.com', messageId: sent.messageId }),
  )
  const blocked = await brevo.transactionalEmails.getTransacBlockedContacts()
  expect(blocked.contacts).toContainEqual(
    expect.objectContaining({
      email: 'sam+bounce@example.com',
      reason: { code: 'hardBounce', message: 'Hard bounce' },
    }),
  )
  await brevo.transactionalEmails.unblockOrResubscribeATransactionalContact({
    email: 'sam+bounce@example.com',
  })
  const after = await brevo.transactionalEmails.getTransacBlockedContacts()
  expect(after.contacts?.map((c) => c.email)).not.toContain('sam+bounce@example.com')
})
