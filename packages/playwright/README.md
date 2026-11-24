# @devitek/mailsink-playwright

[Playwright](https://playwright.dev) fixtures and matchers for
[Mailsink](https://github.com/Devitek/mailsink), the email sink for staging and CI: every
worker gets its own ephemeral workspace, every test waits for the emails your application
sends, opens their links in the page, reads their one-time codes and forces bounces.

- Built on the TypeScript SDK [`@devitek/mailsink`](../sdk/README.md): the `mailsink`
  fixture is an SDK client.
- One ephemeral workspace per worker, created through the Admin API, reset before each test,
  deleted when the worker ends, with an idle TTL as safety net for killed runs.
- Versioned with the Mailsink server: `x.y.z` matches server `x.y.z`.

## Install

```sh
npm install -D @devitek/mailsink-playwright
```

`@playwright/test` 1.47 or later is a peer dependency.

## Quick start

Give the runner the server URL and its admin key (never the application under test):

```sh
MAILSINK_URL=http://localhost:3000
MAILSINK_ADMIN_KEY=change-me-in-ci
```

```ts
// tests/sign-in.spec.ts
import { expect, getCode, openLink, test } from '@devitek/mailsink-playwright'

test('a magic link signs the user in', async ({ page, expectEmail }) => {
  await page.goto('/sign-in')
  await page.getByLabel('Email').fill('jane@example.com')
  await page.getByRole('button', { name: 'Send me a link' }).click()

  // Waits for the first email received since the test started.
  const email = await expectEmail({ to: 'jane@example.com', subject: 'Sign in' })
  await expect(email).toHaveLink('/auth/magic')
  await openLink(page, email, '/auth/magic') // page.goto on the link, as a click in a mailbox
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible()
})

test('a one-time code', async ({ page, expectEmail }) => {
  // ...the application sends "Your code is 482913"
  const email = await expectEmail({ to: 'jane@example.com', subject: 'Your code' })
  await page.getByLabel('Code').fill(getCode(email))
})
```

The application under test sends with the connection of the worker's workspace. Its
credentials, as `.env` variables, are on the `mailsinkWorkspace` worker fixture:

```ts
test.extend<{}, { appServer: string }>({
  appServer: [
    async ({ mailsinkWorkspace }, use) => {
      // RESEND_API_KEY and RESEND_BASE_URL, or SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS...
      const server = await startMyApp({ env: mailsinkWorkspace.env })
      await use(server.url)
      await server.close()
    },
    { scope: 'worker' },
  ],
})
```

## Fixtures

| Fixture | Scope | What |
|---|---|---|
| `mailsinkOptions` | worker, option | How the workspace is created: `url`, `adminKey`, `name`, `connections`, `idleTtlSeconds` (600), `templates`, `metadata`, `workspace` (any other field), `validate` |
| `mailsinkWorkspace` | worker | `id`, `slug`, `url`, `workspaceKey`, `connections` (with credentials), `connection(nameOrKind)`, `env`, `client` and `admin` SDK clients |
| `mailsinkReset` | test, option | What is cleared before each test: `true` (messages, overrides, suppressions), `false`, or `{ messages?, overrides?, suppressions? }` |
| `mailsinkOverride` | test, option | An override active for the whole test, reset after it |
| `mailsink` | test | SDK client of the workspace plus `since`, `workspace`, `expectEmail`, `withOverride` |
| `expectEmail` | test | `mailsink.expectEmail` |

Options go in `playwright.config.ts` or `test.use()`; `test.use` replaces the whole object,
and the keys left out fall back to the environment and the defaults. A file that needs
other connections gets its own workers:

```ts
test.use({
  mailsinkOptions: {
    connections: [{ kind: 'brevo', name: 'app' }],
    templates, // the Brevo templates of the application (`templateId` sends)
  },
})
```

## Waiting for an email

`expectEmail(filters, { timeout = 10_000, since })` resolves the full message (bodies,
links, attachments, recipients, events) of the first email matching the filters received
since the start of the test. Filters are those of the Capture API: `to`, `from`, `subject`
(substrings, case-insensitive), `tag`, `status` (one or several), `connectionId`, `q`.
On a timeout, the error lists the emails that did arrive. Each call is a step in the report.

## Matchers

The package `expect` is `@playwright/test`'s with three matchers; with your own matchers,
`mergeExpects(expect, yours)`.

```ts
expect(email).toHaveLink('/reset')                // substring, RegExp or (url: URL) => boolean
expect(email).toHaveAttachment('invoice.pdf')     // or { filename?, contentType? }
await expect(email).toHaveStatus('delivered')     // waits for the delivery simulation
await expect(email).toHaveStatus('hard_bounce', { recipient: 'jane+bounce@example.com' })
```

`toHaveStatus` re-reads an email answered by `expectEmail` until the status matches or the
expect timeout runs out; on any other message it checks the value as is.

## Links and codes

- `getLink(email, matcher?)` and `getCode(email, { length = 6, pattern? })`: like the SDK
  `findLink` and `extractCode`, but they throw (listing the links) instead of answering
  `null`.
- `openLink(page, email, matcher?, { waitUntil?, timeout?, rebase? })`: `page.goto` on the
  link; `rebase` replaces its origin when the application writes another URL in its emails.

## Overrides

```ts
test('a bounce', async ({ mailsink }) => {
  await mailsink.withOverride({ rules: [{ match: '*+bounce@*', status: 'hard_bounce' }] })
  // ...reset when the test ends, pass or fail
})

test.describe('a failing provider', () => {
  test.use({ mailsinkOverride: { rates: { failed: 100 } } })
  // every test of the group runs under the override
})
```

`withOverride(config, fn)` only lasts for `fn`. Before each test, every override of the
workspace is reset anyway.

## License

MIT
