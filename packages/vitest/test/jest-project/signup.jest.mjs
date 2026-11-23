import { mailsinkWorkspace } from '@devitek/mailsink-vitest/jest'

// Stands for the application under test: sends its welcome email through Mailsink.
async function signUp(email) {
  const mailsink = mailsinkWorkspace()
  const response = await fetch(`${mailsink.url}/v1/emails`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${mailsink.credentials('resend').apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Acme <hello@acme.example.com>',
      to: email,
      subject: 'Welcome to Acme',
      html: '<a href="https://app.example.com/welcome?step=1">Get started</a>',
    }),
  })
  if (!response.ok) throw new Error(`send failed: ${response.status}`)
}

test('the workspace starts empty', async () => {
  await expect(mailsinkWorkspace()).not.toHaveReceivedEmail()
})

test('sends the welcome email', async () => {
  await signUp('ada@example.test')
  const mailsink = mailsinkWorkspace()
  await expect(mailsink).toHaveReceivedEmail({ to: 'ada@example.test', subject: 'Welcome' })
  const message = await mailsink.client.messages.waitFor(
    { to: 'ada@example.test' },
    { since: new Date(0) },
  )
  expect(message).toHaveLink('/welcome?step=1')
  expect(message).not.toHaveLink('/unsubscribe')
  expect(message).not.toHaveStatus(['hard_bounce', 'complained'])
})

test('reports a missing email', async () => {
  await expect(
    expect(mailsinkWorkspace()).toHaveReceivedEmail({ to: 'grace@example.test' }, { timeout: 200 }),
  ).rejects.toThrow(/"Welcome to Acme" to ada@example\.test/)
})
