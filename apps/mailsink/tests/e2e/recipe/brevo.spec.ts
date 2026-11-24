import { BrevoClient } from '@getbrevo/brevo'
import { BASE_URL } from '../web-server'
import { expect, getLink, mailsinkOptions, test } from './fixtures'

// docs/guides/e2e.md, « Sending with the Brevo SDK »: this file's workers get a `brevo`
// connection seeded with the templates of the app; the official SDK is pointed at Mailsink.

test.use({
  mailsinkOptions: {
    ...mailsinkOptions,
    connections: [{ kind: 'brevo', name: 'app' }],
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
