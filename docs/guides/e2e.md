# End-to-end testing with Mailsink

This guide shows how to test the emails of your application in a Playwright suite with
[`@devitek/mailsink-playwright`](../../packages/playwright/README.md): every worker gets its
own ephemeral workspace, the application sends as it does in production, the test waits for
the captured email, opens its links in the page, forces bounces with an override, and
everything is cleaned up. The helpers are built on the TypeScript SDK
([`@devitek/mailsink`](sdk.md)); another runner can use the SDK directly, the same way.
Outside a test runner (shell steps of a CI pipeline), the [command line](cli.md) does the
same: `mailsink workspace create --ephemeral`, `mailsink wait`, `mailsink override set`.

The recipe is executable: `apps/mailsink/tests/e2e/recipe/` in this repository runs it in
CI against the production build (see [Running the example](#running-the-example)).

## 1. Principle

- **One ephemeral workspace per Playwright worker.** Workers run in parallel; tests inside
  one worker run one after the other. A workspace per worker isolates parallel tests
  without paying a workspace per test.
- **The application under test sends with the connection** of that workspace, through its
  usual channel: the native API, the Resend or Brevo SDK (sections 10 and 12) or SMTP
  (section 11). Nothing in the application knows it is being tested, apart from its
  configuration.
- **The test asserts with the Capture API** (`expectEmail`): a long poll that answers as
  soon as a matching email exists.
- **Overrides change the simulated outcome** for the next sends (bounces, delays) without
  touching the workspace settings.
- **Reset before each test, delete at the end.** The idle TTL of the ephemeral workspace is
  the safety net when a worker dies before its teardown.

## 2. Server

Run Mailsink (`docker compose up`, or `pnpm build && pnpm start` from a checkout) with an
admin key, which the Admin API requires, and give the key to the test runner only:

```sh
MAILSINK_URL=http://localhost:3000
MAILSINK_ADMIN_KEY=change-me-in-ci
```

The application under test never sees the admin key: it receives the credentials of the
workspace created for its worker. Simulation jobs are polled every second by default;
`MAILSINK_JOBS_POLL_INTERVAL_MS=100` makes delivery statuses land faster in a test
environment.

## 3. The fixtures

```sh
npm install -D @devitek/mailsink-playwright
```

Import `test` and `expect` from the package instead of `@playwright/test` (or
`mergeTests` / `mergeExpects` them with yours). They bring:

| Fixture | Scope | What |
|---|---|---|
| `mailsinkOptions` | worker, option | `url` (`MAILSINK_URL`), `adminKey` (`MAILSINK_ADMIN_KEY`), `name`, `connections` (one Resend connection `app`), `idleTtlSeconds` (600), `templates`, `metadata`, `workspace` |
| `mailsinkWorkspace` | worker | The workspace: `id`, `slug`, `workspaceKey`, `connections` with their credentials, `env`, SDK clients `client` and `admin` |
| `mailsinkReset` | test, option | What is cleared before each test (default: messages, overrides, suppressions) |
| `mailsinkOverride` | test, option | An override active for the whole test |
| `mailsink` | test | SDK client of the workspace with `since` (start of the test), `expectEmail`, `withOverride` |
| `expectEmail` | test | `mailsink.expectEmail` |

The worker fixture creates the workspace with `POST /admin/workspaces` (ephemeral, idle
TTL, `metadata.createdBy` naming the worker, shown by the web UI banner) and deletes it with
`DELETE /admin/workspaces/:id` when the worker ends.

Hand the credentials to the application under test the way it reads its provider
settings. `mailsinkWorkspace.env` holds the `.env` lines of every connection
(`RESEND_API_KEY` and `RESEND_BASE_URL`, `BREVO_API_KEY` and `BREVO_BASE_URL`, or
`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`), for instance for a server started per
worker:

```ts
// tests/fixtures.ts
import { test as base } from '@devitek/mailsink-playwright'

export const test = base.extend<{}, { appUrl: string }>({
  appUrl: [
    async ({ mailsinkWorkspace }, use) => {
      const app = await startApp({ env: { ...process.env, ...mailsinkWorkspace.env } })
      await use(app.url)
      await app.close()
    },
    { scope: 'worker' },
  ],
})
export { expect, getCode, openLink } from '@devitek/mailsink-playwright'
```

An application started once for the whole run can read the key per request instead (a
header your test build forwards, a seeded tenant setting). The repository example plays
the application with the official Resend SDK configured from `mailsinkWorkspace.env`
(`tests/e2e/recipe/fixtures.ts`).

## 4. Waiting for an email

Drive the application as a user would, then wait for the email:

```ts
test('sign-up sends a welcome email', async ({ page, expectEmail }) => {
  await page.goto('/sign-up')
  await page.getByLabel('Email').fill('jane@example.com')
  await page.getByRole('button', { name: 'Create account' }).click()

  const email = await expectEmail({ to: 'jane@example.com', subject: 'Welcome' })
  expect(email.text).toContain('Hello Jane')
  await expect(email).toHaveStatus('delivered')
})
```

- **`since` is the start of the test.** `expectEmail` only sees emails received from then
  on, so an email the application stored before the call still counts, and an email of an
  earlier test never does. Pass `{ since }` to narrow it, `{ timeout }` (10 s by default;
  longer waits are split into 30 s long polls).
- **Filters** are those of `GET /capture/messages`: `to`, `from`, `subject` (substrings,
  case-insensitive), `tag`, `status` (one or several), `connectionId`, `q`. Full text
  search (`q`) covers the subject and bodies, but only the first 100 000 characters of each
  message: assert on a large email with `subject`, `to` or a `tag`.
- **Waiting on a status** (`expectEmail({ status: 'hard_bounce' })`) wakes when the
  simulation changes a status, not only on new messages.
- **The answer is the full detail**: bodies, headers, links, attachments, recipients with
  their status, and the event history (`accepted`, `sent`, then the final status);
  `mailsink.messages.raw(id)` is the MIME source.
- **On a timeout**, the error lists the emails that did arrive since the start of the test
  (recipients, subject, status): a typo in the filter shows at once.
- `since` is read on the server clock (`mailsink.now()` of the SDK, from the `Date` header
  of the answers, D261), so a runner whose clock is off does not miss or catch stray
  emails. It is precise to about one second: pass a `since` of your own to be stricter.

## 5. Matchers, links and codes

```ts
expect(email).toHaveLink('/confirm')                 // substring, RegExp or (url: URL) => boolean
expect(email).toHaveAttachment({ filename: 'invoice.pdf', contentType: 'application/pdf' })
await expect(email).toHaveStatus('delivered')        // waits for the simulation
await expect(email).toHaveStatus('hard_bounce', { recipient: 'jane+bounce@example.com' })

const code = getCode(email)                          // first standalone 6-digit run
await openLink(page, email, '/auth/magic')           // page.goto on the link
```

- `toHaveStatus` re-reads an email answered by `expectEmail` until its status (or the
  recipient's) matches, up to the expect timeout.
- `getLink(email, matcher?)` and `getCode(email, { length, pattern })` throw (listing the
  links) when nothing matches; the SDK `findLink` and `extractCode` answer `null`.
- `openLink(page, email, matcher, { rebase })` opens the link as a user clicking it in a
  mailbox would. `rebase: 'http://127.0.0.1:3000'` replaces its origin when the application
  writes its public URL in emails while the test runs it elsewhere. After the navigation,
  wait for something the page shows once it is interactive before clicking: a server
  rendered page may not be hydrated yet.

## 6. Forcing a bounce with an override

An override replaces the simulation settings of the workspace (or of one connection) for
the next sends. A recipient rule makes the outcome deterministic per address: here, every
`+bounce` address hard bounces.

```ts
test('a bounced address is reported', async ({ mailsink, expectEmail }) => {
  await mailsink.withOverride({ rules: [{ match: '*+bounce@*', status: 'hard_bounce' }] })
  // ...the application sends to jane+bounce@example.com
  const email = await expectEmail({ to: 'jane+bounce@example.com', status: 'hard_bounce' })
})

test.describe('a failing provider', () => {
  test.use({ mailsinkOverride: { rates: { failed: 100 } } }) // every test of the group
})
```

- `withOverride(config, { connectionId?, ttl? })` lasts until the end of the test: the
  fixture resets its scope afterwards, pass or fail. `withOverride(config, fn)` only lasts
  for `fn`.
- Globs match the whole address, case-insensitive: `*` any run (`@` included), `?` one
  character. The first matching rule wins; other recipients keep the drawn status
  (`delivered` with the default settings).
- A rule can also set `delayMs` (the bounce arrives later) and `smtpCode`. `rates`
  (percentages per status), `latency` and `chaos` are the other override fields.
- `hard_bounce` and `complained` add the address to the suppression list
  (`mailsink.suppressions.list()`): later sends to it are `suppressed` at once, as with a
  real provider. The reset before the next test empties it.
- `withOverride` answers the `OverrideState`, with the effective settings of every
  connection: assert on it when the test is about the override itself.

## 7. Reset between tests

Tests of one worker share its workspace. Before each test, the `mailsink` fixture deletes
the messages (and their logs), resets every active override (workspace-wide and per
connection) and empties the suppression list. `test.use({ mailsinkReset: false })` keeps
them, `{ messages: false }` keeps the messages only. `resetWorkspace(client, options)` does
the same by hand.

## 8. Cleanup

- **Worker teardown** deletes the workspace and everything it owns at once
  (`DELETE /admin/workspaces/:id`, retried on a dropped keep-alive socket); open streams
  receive `workspace.deleted` and pending waits answer 404.
- **Idle TTL** (`idleTtlSeconds`, 600 by default, 60 s to 30 days): every authenticated
  call (sending, Capture API) pushes the expiry back; once a workspace has been idle that
  long, the ephemeral GC (every 30 s) deletes it. It catches the workspaces of crashed or
  killed runs. An open SSE stream alone does not count as activity.
- Ephemeral workspaces stay out of `GET /admin/workspaces` unless `includeEphemeral=true`.

## 9. Real time (optional)

`mailsink.stream.subscribe(handler, { types?, connectionId? })` reads `GET /capture/stream`
(Server-Sent Events): `message.created`, `message.event` (replayable with `Last-Event-ID`,
which the SDK sends when it reconnects), `message.status`, `webhook.delivery` (section 13),
`log.api` and `log.smtp` (section 14), `override.changed`, `messages.purged` and
`workspace.deleted` (last frame). `expectEmail` covers most assertions; the stream suits
tests about live UI updates. `tests/e2e/recipe/realtime.spec.ts` reads it.

## 10. Sending with the Resend SDK

An application that sends with the official `resend` package needs no code change: the
default connection is a `resend` one, and the SDK reads its base URL from
`RESEND_BASE_URL` (or the `baseUrl` option). Start the application under test with
`mailsinkWorkspace.env`:

```sh
RESEND_API_KEY=msk_…                    # the connection key
RESEND_BASE_URL=http://localhost:3000   # MAILSINK_URL, no path
```

```ts
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const { data, error } = await resend.emails.send({
  from: 'Acme <hello@acme.test>',
  to: ['jane@example.com'],
  subject: 'Welcome',
  html: '<p>Hi, <a href="https://app.acme.test/confirm">confirm</a></p>',
})
// data.id is a uuid, as with Resend; resend.emails.get(data.id) reads the message back.
```

What to know when asserting:

- The message is stored with `source: 'resend'`; its Mailsink id is `msg_` followed by the
  Resend id (`mailsink.messages.get(`msg_${data.id}`)`).
- `resend.batch.send([...])` is all or nothing (`batchValidation: 'strict'`, the SDK
  default): one invalid email refuses the whole batch and stores nothing. With
  `batchValidation: 'permissive'` the valid emails are stored and the others come back in
  `errors` (`{ index, message }`). Batch emails take no `attachments`, as with Resend.
- `idempotencyKey` (24 h, at most 256 characters) replays the first `id`; the same key with
  another body is `409 invalid_idempotent_request`.
- Errors come back in Resend's shape through the SDK `error` object (`{ statusCode, name,
  message }`): `422 missing_required_field`, `400 validation_error`, `401
  missing_api_key` (no key), `403 restricted_api_key` (a key of another connection
  kind), `429 rate_limit_exceeded`. An override with a rate limit or chaos (section 6)
  applies here too, with `ratelimit-*` headers next to `X-RateLimit-*`.
- Not emulated: hosted Resend templates (`template`) and attachment `path` URLs are
  refused (Mailsink fetches nothing), `scheduled_at` is accepted but the delivery is not
  delayed, `text` is not generated from `html`.

## 11. Sending over SMTP

An application that sends through SMTP (Nodemailer or any client) gets an `smtp`
connection:

```ts
test.use({ mailsinkOptions: { connections: [{ kind: 'smtp', name: 'app' }] } })
```

`mailsinkWorkspace.env` then carries `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER` and `SMTP_PASS`
(`mailsinkWorkspace.connection('smtp').credentials` has them typed):

```ts
import { createTransport } from 'nodemailer'

const transport = createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: false, // STARTTLS only, when the server has a certificate
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
})
const info = await transport.sendMail({
  from: 'app@acme.test',
  to: 'jane@example.com',
  subject: 'Welcome',
  text: 'Hello',
})
// info.response: "250 2.0.0 Ok: queued as msg_…", the id of mailsink.messages.get(id)
```

- Assertions do not change: `expectEmail`, overrides and the reset work the same on SMTP
  messages (`source: 'smtp'`). The MIME source (`messages.raw`) is the message exactly as
  the client sent it.
- Recipients are the `RCPT TO` addresses: an address only in the envelope is a `bcc`
  recipient, a header address never given in `RCPT TO` is not a recipient.
- AUTH (PLAIN or LOGIN) is required. Plain-text AUTH is accepted without TLS; STARTTLS is
  offered only when the server has `MAILSINK_SMTP_TLS_CERT` and `MAILSINK_SMTP_TLS_KEY`
  (with a self-signed certificate, pass `tls: { rejectUnauthorized: false }`).
- Errors arrive as SMTP replies, e.g. `535 5.7.8` (credentials), `552` (over
  `MAILSINK_MAX_MESSAGE_BYTES`: refused at `MAIL FROM` when the client declares its size,
  during `DATA` otherwise), `451 4.7.1 Rate limit exceeded, retry in Ns`, or the chaos
  codes of an override (`421`, `451`, `452`, `550`, `(chaos injected)`). Nodemailer
  rejects `sendMail` with `responseCode` and `response` set.
- Behind a port mapping, set `MAILSINK_SMTP_PUBLIC_HOST` / `MAILSINK_SMTP_PUBLIC_PORT` so
  the credentials name the reachable host and port.

## 12. Sending with the Brevo SDK

An application that sends with Brevo keeps its code: ask for a `brevo` connection and seed
the templates the application uses (`templateId`), from a JSON file kept with the tests:

```ts
import { readFileSync } from 'node:fs'

const templates = JSON.parse(readFileSync('tests/brevo-templates.json', 'utf8'))
// [{ "externalId": 12, "name": "Reset", "subject": "Reset for {{ params.name }}",
//    "html": "<a href=\"{{ params.url }}\">Reset</a>",
//    "sender": { "email": "support@acme.test", "name": "Support" } }]

test.use({ mailsinkOptions: { connections: [{ kind: 'brevo', name: 'app' }], templates } })
```

`mailsinkWorkspace.env` carries `BREVO_API_KEY` and `BREVO_BASE_URL` (`<MAILSINK_URL>/v3`);
the application builds its client from them:

```ts
import { BrevoClient } from '@getbrevo/brevo'

const brevo = new BrevoClient({
  apiKey: process.env.BREVO_API_KEY,
  baseUrl: process.env.BREVO_BASE_URL, // https://api.brevo.com/v3 in production
})
await brevo.transactionalEmails.sendTransacEmail({
  templateId: 12,
  to: [{ email: 'jane@example.com' }],
  params: { name: 'Jane', url: 'https://app.acme.test/reset?t=1' },
})
```

The captured message has the rendered subject and bodies (`Reset for Jane`), its links
(`https://app.acme.test/reset?t=1`, ready for `openLink`) and `source: 'brevo'`.
`messageVersions` store one message per version. Templates can also be managed after
provisioning with `mailsinkWorkspace.admin.admin.templates` (see 03-contracts, « Brevo
templates »). Brevo errors keep Brevo's shape (`{ code, message }`, 400 for an invalid
body), and overrides apply to the dialect like to the native API (rate limit with
`x-sib-ratelimit-*` headers, chaos). `tests/e2e/recipe/brevo.spec.ts` runs this flow with
the official SDK.

An application that reads back from Brevo works too (see 03-contracts, « Brevo read
routes »): `getTransacEmailsList` lists what the connection sent (by `email`, `templateId`
or `messageId`), `getTransacBlockedContacts` reads the suppression list of the workspace
(hard bounces and complaints of the simulation, for instance from a recipient rule such as
`{ match: '*+bounce@*', status: 'hard_bounce' }`) and
`unblockOrResubscribeATransactionalContact` removes an address from it.

For Brevo webhooks, point the endpoint at the application like in production: the
`X-Mailin-custom` header given in `headers` comes back in every event, a simulated
`invalid` status (an invalid address, for instance from a rule such as
`{ match: '*+invalid@*', status: 'invalid' }`) arrives as `invalid_email` (subscription
`invalid`), a simulated `failed` status as `error` (subscription `error`; the official SDK does not type
this event name, so a TypeScript client casts it, for instance `'error' as never`), and basic auth credentials
written in the URL (`https://user:pass@host/hook`) are sent as an `Authorization: Basic`
header (section 13).

## 13. Webhooks

To test the webhook handler of the application, register an endpoint of the workspace
that points at it (or at a receiver the test starts) and let the simulation post the
events. Endpoint URLs are free by default, local addresses included; a server started with
`MAILSINK_WEBHOOK_BLOCK_PRIVATE=true` refuses private, loopback and link-local
destinations (`422 private_webhook_url`), so keep that option off for this setup.

```ts
const endpoint = await mailsink.webhooks.create({
  connectionId: null, // every connection of the workspace
  url: 'http://127.0.0.1:4000/hooks/mailsink', // your handler, or a test receiver
  events: ['email.delivered', 'email.hard_bounced'],
  // payloadFormat: 'resend' | 'brevo' | 'unified' (default: the connection kind)
})
// endpoint.secret (whsec_…) is shown once
```

- **Test send**: `mailsink.webhooks.test(endpoint.id, { event? })` (default
  `email.delivered`) posts one signed sample event at once and answers the delivery with
  its attempt (status, response code, headers sent). Use it to check the handler and its
  signature verification before any email.
- **Real events**: every event of the simulation (or of `messages.triggerEvent`, or a send
  to a suppressed address) goes to the endpoints whose scope and subscription match. Each
  delivery is retried 8 times with backoff when the receiver fails.
- **Assert on the deliveries** with `mailsink.webhooks.deliveries.list({ endpointId })`
  (or `messageId`) in an `expect.poll` until the delivery is `succeeded`;
  `deliveries.get(id)` has the exact body and headers of every attempt, and
  `deliveries.replay(id, { mode })` sends it again (`exact` or `resign`).
- Signatures: the `unified` format signs `X-Mailsink-Signature` (HMAC SHA-256 of
  `<timestamp>.<body>` with the secret), `resend` signs as Svix (the `svix` package
  verifies it), `brevo` sends the configured `Authorization` (basic auth written in a brevo
  endpoint URL is stored as `brevoAuth` basic and never shown in the URL again).

`tests/e2e/recipe/webhooks.spec.ts` starts a receiver with `node:http`, sends a test event
and waits for the `email.delivered` delivery of a real send.

## 14. Reading the logs

Every API call (refused ones included) and every SMTP session is logged, which helps when a
test fails on the application side:

- `mailsink.logs.api.list({ since, status: ['4xx'] })`: method, path, status, `errorCode`,
  duration and the message ids created, also filtered by `dialect`, `errorCode`, `path`,
  `messageId`, `until`. `logs.api.get(id)` adds the headers (credentials redacted) and the
  bodies (attachments stripped, long bodies truncated).
- `mailsink.logs.smtp.list()` and `.get(id)`: SMTP sessions with their outcome and
  transcript (AUTH secrets redacted).
- Calls without workspace (an unknown key, a missing header, the Admin API) are read with
  the admin key: `mailsinkWorkspace.admin.admin.logs.list()`.

```ts
const failed = await mailsink.logs.api.list({ since: mailsink.since, status: ['4xx'] })
// why the application's send was refused
```

## Running the example

The repository suite starts the production build with a fixed, non-secret admin key
(`E2E_ADMIN_KEY` overrides it) and passes it with the server URL through
`mailsinkOptions` (`tests/e2e/recipe/fixtures.ts`); the application under test is played
by the Resend SDK. It runs in CI with every other scenario (`pnpm test:e2e`):

```sh
pnpm build
pnpm --filter @mailsink/app exec playwright install --with-deps chromium   # once
pnpm --filter @mailsink/app exec playwright test tests/e2e/recipe
```

See [CONTRIBUTING.md](../../CONTRIBUTING.md#end-to-end-tests) for ports and for running
Playwright in its Docker image.
