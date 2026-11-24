import { BASE_URL } from '../web-server'
import { expect, getCode, openLink, test } from './fixtures'

// The executable example of docs/guides/e2e.md: the app sends, `expectEmail` waits for the
// email since the start of the test, matchers check it, links open in the page, overrides
// force bounces and are reset after the test.

test('a sent email is captured, then delivered by the simulation', async ({
  app,
  expectEmail,
  mailsink,
}) => {
  const id = await app.send({
    to: 'jane@example.com',
    subject: 'Welcome to Acme',
    text: 'Hello Jane',
    attachments: [{ filename: 'terms.pdf', content: Buffer.from('%PDF-1.4').toString('base64') }],
  })

  const email = await expectEmail({ to: 'jane@example.com', subject: 'Welcome' })
  expect(email).toMatchObject({ id, text: 'Hello Jane', source: 'resend' })
  expect(email).toHaveAttachment({ filename: 'terms.pdf', contentType: 'application/pdf' })
  // Waits for the delivery simulation (the email was answered as soon as it was stored).
  await expect(email).toHaveStatus('delivered')

  const events = (await mailsink.messages.get(id)).events.map((e) => e.type)
  expect(events).toEqual(['accepted', 'sent', 'delivered'])
})

test('a magic link opens in the page, a one-time code is read', async ({
  app,
  expectEmail,
  page,
}) => {
  // The application under test writes its own URL in the email: here, a page of the
  // server under test stands for it.
  await app.send({
    to: 'jane@example.com',
    subject: 'Your sign-in link',
    html:
      `<p>Your code is <b>482913</b>.</p>` +
      `<a href="${BASE_URL}/login?redirect=%2F&amp;source=email">Sign in</a>`,
  })

  const email = await expectEmail({ to: 'jane@example.com', subject: 'sign-in link' })
  expect(email).toHaveLink('/login?redirect=')
  expect(email).not.toHaveLink(/reset-password/)
  expect(getCode(email)).toBe('482913')

  const { url } = await openLink(page, email, '/login')
  expect(url).toBe(`${BASE_URL}/login?redirect=%2F&source=email`)
  await expect(page.getByRole('heading', { name: 'Sign in to this instance' })).toBeVisible()
})

test('an override forces a bounce on matching recipients only', async ({
  app,
  expectEmail,
  mailsink,
}) => {
  // Reset when the test ends, whatever happens.
  await mailsink.withOverride({ rules: [{ match: '*+bounce@*', status: 'hard_bounce' }] })

  const bounced = await app.send({ to: 'jane+bounce@example.com', subject: 'Reset', text: 'x' })
  const delivered = await app.send({ to: 'bob@example.com', subject: 'Reset', text: 'x' })

  expect((await expectEmail({ status: 'hard_bounce' })).id).toBe(bounced)
  const other = await expectEmail({ to: 'bob@example.com' })
  expect(other.id).toBe(delivered)
  await expect(other).toHaveStatus('delivered')

  // The hard bounce joined the suppression list (emptied before the next test).
  const suppressions = await mailsink.suppressions.list()
  expect(suppressions.data).toEqual([
    expect.objectContaining({ email: 'jane+bounce@example.com', reason: 'hard_bounce' }),
  ])
})

test('each recipient has its own status', async ({ app, expectEmail, mailsink }) => {
  await mailsink.withOverride({ rules: [{ match: '*+bounce@*', status: 'hard_bounce' }] })
  await app.send({
    to: ['jane+bounce@example.com', 'bob@example.com'],
    subject: 'Team invite',
    text: 'x',
  })

  const email = await expectEmail({ subject: 'Team invite' })
  await expect(email).toHaveStatus('hard_bounce', { recipient: 'jane+bounce@example.com' })
  await expect(email).toHaveStatus('delivered', { recipient: 'bob@example.com' })
  await expect(email).not.toHaveStatus('delivered', { recipient: 'nobody@example.com' })
})

test('a link to the production URL opens on the server under test (rebase)', async ({
  app,
  expectEmail,
  page,
}) => {
  // The application writes its public URL; the test runs it elsewhere.
  await app.send({
    to: 'jane@example.com',
    subject: 'Confirm your address',
    html: '<a href="https://app.acme.test/login?source=email#confirm">Confirm</a>',
  })

  const email = await expectEmail({ subject: 'Confirm your address' })
  const { url, response } = await openLink(page, email, '/login', { rebase: BASE_URL })
  expect(url).toBe(`${BASE_URL}/login?source=email#confirm`)
  expect(response?.ok()).toBe(true)
  await expect(page.getByRole('heading', { name: 'Sign in to this instance' })).toBeVisible()
})

test.describe('with an override for every test of the group', () => {
  test.use({ mailsinkOverride: { rates: { failed: 100 } } })

  test('every send fails', async ({ app, expectEmail }) => {
    await app.send({ to: 'jane@example.com', subject: 'Receipt', text: 'x' })
    const email = await expectEmail({ to: 'jane@example.com', status: 'failed' })
    await expect(email).toHaveStatus('failed')
  })
})

test('each test starts from a blank workspace', async ({ mailsink }) => {
  expect((await mailsink.messages.list()).data).toEqual([])
  expect(await mailsink.overrides.get()).toMatchObject({ workspace: null, connections: [] })
  expect((await mailsink.suppressions.list()).data).toEqual([])
})

test('a missing email fails with what arrived instead', async ({ app, expectEmail }) => {
  await app.send({ to: 'bob@example.com', subject: 'Invoice', text: 'x' })
  const error = await expectEmail({ to: 'jane@example.com' }, { timeout: 500 }).catch((e) => e)
  expect(String(error)).toContain('no email matched {"to":"jane@example.com"} within 500 ms')
  expect(String(error)).toContain('to bob@example.com: "Invoice"')
})
