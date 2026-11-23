# End-to-end testing with Mailsink

This guide shows how to test the emails of your application in an end-to-end suite
(Playwright here, the same calls work from any runner): every worker gets its own
ephemeral workspace, the application sends as it does in production, the test waits for
the captured message, forces bounces with an override, and everything is cleaned up.

The recipe is executable: `apps/mailsink/tests/e2e/recipe/` in this repository runs it in
CI against the production build (see [Running the example](#running-the-example)).

## 1. Principle

- **One ephemeral workspace per Playwright worker.** Workers run in parallel; tests inside
  one worker run one after the other. A workspace per worker isolates parallel tests
  without paying a workspace per test.
- **The application under test sends with the connection key** of that workspace, through
  its usual channel: the native API, the Resend or Brevo SDK (sections 10 and 12) or SMTP
  (section 11). Nothing in the application knows it is being tested, apart from its
  configuration.
- **The test asserts with the Capture API** and the workspace key: `GET
  /capture/messages?wait=true` long polls until a matching message exists.
- **Overrides change the simulated outcome** for the next sends (bounces, delays) without
  touching the workspace settings.
- **Reset before each test, delete at the end.** The idle TTL of the ephemeral workspace is
  the safety net when a worker dies before its teardown.

## 2. Server

Run Mailsink (`docker compose up`, or `pnpm build && pnpm start` from a checkout) with an
admin key, which the Admin API requires:

```sh
MAILSINK_ADMIN_KEY=change-me-in-ci
```

Give the key to the test runner only (for instance `MAILSINK_ADMIN_KEY` and
`MAILSINK_URL` in its environment). The application under test never sees it: it receives
the connection key of the workspace created for its worker.

Simulation jobs are polled every second by default; `MAILSINK_JOBS_POLL_INTERVAL_MS=100`
makes delivery statuses land faster in a test environment.

## 3. The fixture

`POST /admin/workspaces` creates the workspace with one connection and returns its secrets
once: the workspace key (`mskw_…`, Capture API) and, per connection, its credentials
(`msk_…` API key, or SMTP user and password) plus an `.env` snippet.

```ts
// tests/mailsink.ts
import { type APIRequestContext, test as base } from '@playwright/test'

const MAILSINK_URL = process.env.MAILSINK_URL ?? 'http://localhost:3000'
const bearer = (key: string) => ({ authorization: `Bearer ${key}` })

type Mailsink = { id: string; connectionKey: string; capture: APIRequestContext }

export const test = base.extend<{ mailsink: Mailsink }, { workerMailsink: Mailsink }>({
  workerMailsink: [
    async ({ playwright }, use, workerInfo) => {
      const admin = await playwright.request.newContext({
        baseURL: MAILSINK_URL,
        extraHTTPHeaders: bearer(process.env.MAILSINK_ADMIN_KEY ?? ''),
      })
      const res = await admin.post('/admin/workspaces', {
        data: {
          name: `e2e-${workerInfo.workerIndex}`,
          ephemeral: true,
          idleTtlSeconds: 600, // deleted 10 min after its last call if the teardown never runs
          // Shown by the web UI banner of the workspace: who created it.
          metadata: { createdBy: `playwright · worker ${workerInfo.workerIndex}` },
          connections: [{ kind: 'resend', name: 'app' }],
        },
      })
      if (res.status() !== 201) throw new Error(await res.text())
      const created = await res.json()
      const capture = await playwright.request.newContext({
        baseURL: MAILSINK_URL,
        extraHTTPHeaders: bearer(created.workspaceKey),
      })
      await use({
        id: created.workspace.id,
        connectionKey: created.connections[0].credentials.apiKey,
        capture,
      })
      await capture.dispose()
      // maxRetries: the admin context sat idle for the whole worker, so its keep-alive
      // socket may be closing; Playwright retries only ECONNRESET, before the server saw it.
      await admin.delete(`/admin/workspaces/${created.workspace.id}`, { maxRetries: 3 })
      await admin.dispose()
    },
    { scope: 'worker' },
  ],
  // Test-scoped: resets the worker's workspace before each test (section 7).
  mailsink: async ({ workerMailsink }, use) => {
    await reset(workerMailsink.capture)
    await use(workerMailsink)
  },
})

export { expect } from '@playwright/test'
```

Hand `connectionKey` to the application under test the way it reads its provider key:
an environment variable of the server process started per worker, a header your test
build forwards, a seeded tenant setting. The repository example plays the application
itself and posts to `POST /v1/emails` with the key.

## 4. Sending with the application under test

Drive the application as a user would (sign up, reset a password...). For the assertion
to be exact, take the time **before** the action:

```ts
test('sign-up sends a welcome email', async ({ page, mailsink }) => {
  const since = new Date().toISOString()
  await page.goto('/sign-up')
  await page.getByLabel('Email').fill('jane@example.com')
  await page.getByRole('button', { name: 'Create account' }).click()
  // ...assertions below
})
```

## 5. Asserting with `wait=true`

`GET /capture/messages?wait=true` answers as soon as at least one message matches the
filters, or `408 wait_timeout` after `timeout` milliseconds (5 000 by default, at most
30 000). Every filter of the list works: `to`, `from`, `subject`, `tag`, `status`,
`connectionId`, `since`, `until`, `q`.

```ts
const res = await mailsink.capture.get('/capture/messages', {
  params: { wait: true, since, to: 'jane@example.com', subject: 'Welcome', timeout: 10_000 },
})
expect(res.status()).toBe(200)
const [message] = (await res.json()).data

const detail = await (await mailsink.capture.get(`/capture/messages/${message.id}`)).json()
expect(detail.links.map((l: { url: string }) => l.url)).toContain('https://app.test/confirm')
```

- **Always pass `since`.** Without it, `since` is the time the request arrives: a message
  your application committed a few milliseconds earlier would not count, and the call
  would time out. With `since` taken before the action, a message already there answers
  at once and a later one wakes the call.
- **Wait on a status** to assert the simulated delivery: `status=delivered`, or
  `status=hard_bounce` (comma-separated or repeated for several). The call wakes when the
  simulation changes a status, not only on new messages.
- **Full text search (`q`)** covers the subject and bodies, but only the first 100 000
  characters of each message: assert on a large email with `subject`, `to` or a `tag`, or
  read its detail.
- The detail (`GET /capture/messages/:id`) has the bodies, headers, links, attachments,
  recipients with their status, and the event history (`accepted`, `sent`, then the
  final status); `GET /capture/messages/:id/raw` is the MIME source.

## 6. Forcing a bounce with an override

An override replaces the simulation settings of the workspace (or of one connection) for
the next sends, until it is reset or its `ttl` runs out. A recipient rule makes the
outcome deterministic per address: here, every `+bounce` address hard bounces.

```ts
await mailsink.capture.post('/capture/override', {
  data: {
    config: { rules: [{ match: '*+bounce@*', status: 'hard_bounce' }] },
    ttl: '10m',
  },
})
const since = new Date().toISOString()
// ...the application sends to jane+bounce@example.com
const res = await mailsink.capture.get('/capture/messages', {
  params: { wait: true, since, status: 'hard_bounce', timeout: 10_000 },
})
```

- Globs match the whole address, case-insensitive: `*` any run (`@` included), `?` one
  character. The first matching rule wins; other recipients keep the drawn status
  (`delivered` with the default settings).
- A rule can also set `delayMs` (the bounce arrives later) and `smtpCode`. `rates`
  (percentages per status), `latency` and `chaos` are the other override fields.
- `hard_bounce` and `complained` add the address to the suppression list
  (`GET /capture/suppressions`): later sends to it are `suppressed` at once, as with a
  real provider. The reset below empties it.
- The response of `POST /capture/override` is the `OverrideState`, with the effective
  settings of every connection: assert on it when the test is about the override itself.

## 7. Reset between tests

Tests of one worker share its workspace. Reset it before each test (the `mailsink`
fixture above):

```ts
async function reset(capture: APIRequestContext) {
  await Promise.all([
    capture.delete('/capture/messages'), // messages and their logs
    capture.post('/capture/override/reset', { data: {} }), // workspace-wide override
    capture.delete('/capture/suppressions'), // whole suppression list
  ])
}
```

`POST /capture/override/reset` with `{ connectionId }` resets a connection-scoped
override; both resets are idempotent.

## 8. Cleanup

- **`DELETE /admin/workspaces/:id`** (worker teardown) deletes the workspace and
  everything it owns at once; open streams receive `workspace.deleted` and pending
  `wait=true` calls answer 404.
- **Idle TTL** (`idleTtlSeconds`, 60 s to 30 days, `MAILSINK_DEFAULT_IDLE_TTL` when
  omitted): every authenticated call (sending, Capture API) pushes the expiry back; once
  a workspace has been idle that long, the ephemeral GC (every 30 s) deletes it. It
  catches the workspaces of crashed or killed runs. An open SSE stream alone does not
  count as activity.
- Ephemeral workspaces stay out of `GET /admin/workspaces` unless `includeEphemeral=true`.

## 9. Real time (optional)

`GET /capture/stream` (Server-Sent Events, workspace key) carries `message.created`,
`message.event` (each stored event, replayable with `Last-Event-ID`), `message.status`
(aggregated status after a simulation run), `webhook.delivery` (a delivery created or
attempted, section 13), `log.api` and `log.smtp` (section 14), `override.changed`,
`messages.purged` and `workspace.deleted` (last frame). Filters: `types=message.created,message.status`,
`connectionId=…`. `wait=true` covers most assertions; the stream suits tests about live
UI updates. `tests/e2e/recipe/realtime.spec.ts` reads it with `fetch`.

## 10. Sending with the Resend SDK

An application that sends with the official `resend` package needs no code change: the
fixture's `resend` connection gives it a key, and the SDK reads its base URL from
`RESEND_BASE_URL` (or the `baseUrl` option). Start the application under test with:

```sh
RESEND_API_KEY=msk_…          # connections[0].credentials.apiKey of the fixture
RESEND_BASE_URL=http://localhost:3000   # MAILSINK_URL, no path
```

The `.env` snippet of the connection (`connections[0].envSnippet`) carries both lines.

```ts
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const { data, error } = await resend.emails.send({
  from: 'Acme <hello@app.test>',
  to: ['jane@example.com'],
  subject: 'Welcome',
  html: '<p>Hi, <a href="https://app.test/confirm">confirm</a></p>',
})
// data.id is a uuid, as with Resend; resend.emails.get(data.id) reads the message back.
```

What to know when asserting:

- The message is stored with `source: 'resend'`; assert on it with `wait=true` as in
  section 5. Its Mailsink id is `msg_` followed by the Resend id
  (`GET /capture/messages/msg_<data.id>`).
- `resend.batch.send([...])` is all or nothing (`batchValidation: 'strict'`, the SDK
  default): one invalid email refuses the whole batch and stores nothing. With
  `batchValidation: 'permissive'` the valid emails are stored and the others come back in
  `errors` (`{ index, message }`). Batch emails take no `attachments`, as with Resend.
- `idempotencyKey` (24 h, at most 256 characters) replays the first `id`; the same key with
  another body is `409 invalid_idempotent_request`.
- Errors come back in Resend's shape through the SDK `error` object (`{ statusCode, name,
  message }`): `422 missing_required_field`, `400 validation_error`, `401
  missing_api_key` (no key), `403 restricted_api_key` (a key of another connection
  kind), `429 rate_limit_exceeded`. An
  override with a rate limit or chaos (section 6) applies here too, with `ratelimit-*`
  headers next to `X-RateLimit-*`.
- Not emulated: hosted Resend templates (`template`) and attachment `path` URLs are
  refused (Mailsink fetches nothing), `scheduled_at` is accepted but the delivery is not
  delayed, `text` is not generated from `html`.

## 11. Sending over SMTP

An application that sends through SMTP (Nodemailer or any client) gets an `smtp`
connection: create the workspace with `connections: [{ kind: 'smtp', name: 'app' }]` and
read `credentials` (`smtpHost`, `smtpPort`, `smtpUser`, `smtpPass`) instead of `apiKey`.
Point the application's SMTP settings at them; the `.env` snippet carries `SMTP_HOST`,
`SMTP_PORT`, `SMTP_USER` and `SMTP_PASS`.

```ts
import { createTransport } from 'nodemailer'

const { smtpHost, smtpPort, smtpUser, smtpPass } = created.connections[0].credentials
const transport = createTransport({
  host: smtpHost,
  port: smtpPort,
  secure: false, // STARTTLS only, when the server has a certificate
  auth: { user: smtpUser, pass: smtpPass },
})
const info = await transport.sendMail({
  from: 'app@example.test',
  to: 'jane@example.com',
  subject: 'Welcome',
  text: 'Hello',
})
// info.response: "250 2.0.0 Ok: queued as msg_…", the id of GET /capture/messages/:id
```

- Assertions do not change: `wait=true`, `since`, overrides and the reset work the same
  on SMTP messages (`source: 'smtp'`). The MIME source (`/raw`) is the message exactly as
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

An application that sends with Brevo keeps its code: give it a `brevo` connection and point
the official SDK at Mailsink. The fixture asks for the connection and seeds the templates
the application uses (`templateId`), from a JSON file kept with the tests:

```ts
import { readFileSync } from 'node:fs'

const templates = JSON.parse(readFileSync('tests/brevo-templates.json', 'utf8'))
// [{ "externalId": 12, "name": "Reset", "subject": "Reset for {{ params.name }}",
//    "html": "<a href=\"{{ params.url }}\">Reset</a>",
//    "sender": { "email": "support@app.io", "name": "Support" } }]

const res = await playwright.request.post(`${MAILSINK_URL}/admin/workspaces`, {
  headers: bearer(ADMIN_KEY),
  data: {
    name: `e2e-${workerInfo.workerIndex}`,
    ephemeral: true,
    connections: [{ kind: 'brevo', name: 'app' }],
    templates,
  },
})
const { connections } = await res.json()
// connections[0].credentials: { apiKey: 'msk_…', baseUrl: '<MAILSINK_URL>/v3' }
// connections[0].envSnippet: BREVO_API_KEY=… BREVO_BASE_URL=…
```

The application builds its client from those two variables:

```ts
import { BrevoClient } from '@getbrevo/brevo'

const brevo = new BrevoClient({
  apiKey: process.env.BREVO_API_KEY,
  baseUrl: process.env.BREVO_BASE_URL, // https://api.brevo.com/v3 in production
})
await brevo.transactionalEmails.sendTransacEmail({
  templateId: 12,
  to: [{ email: 'jane@example.com' }],
  params: { name: 'Jane', url: 'https://app.test/reset?t=1' },
})
```

The captured message has the rendered subject and bodies (`Reset for Jane`), its links
(`https://app.test/reset?t=1`, ready to follow in the test) and `source: 'brevo'`; assert
on it with `wait=true` as above. `messageVersions` store one message per version.
Templates can also be managed after provisioning with
`/admin/workspaces/:id/templates` (see 03-contracts, « Brevo templates »). Brevo errors
keep Brevo's shape (`{ code, message }`, 400 for an invalid body), and overrides apply to
the dialect like to the native API (rate limit with `x-sib-ratelimit-*` headers, chaos).
`tests/e2e/recipe/brevo.spec.ts` runs this flow with the official SDK.

## 13. Webhooks

To test the webhook handler of the application, register an endpoint of the workspace
that points at it (or at a receiver the test starts) and let the simulation post the
events. Endpoint URLs are free by default, local addresses included; a server started with
`MAILSINK_WEBHOOK_BLOCK_PRIVATE=true` refuses private, loopback and link-local
destinations (`422 private_webhook_url`), so keep that option off for this setup.

```ts
const created = await mailsink.capture.post('/capture/webhooks', {
  data: {
    connectionId: null, // every connection of the workspace
    url: 'http://127.0.0.1:4000/hooks/mailsink', // your handler, or a test receiver
    events: ['email.delivered', 'email.hard_bounced'],
    // payloadFormat: 'resend' | 'brevo' | 'unified' (default: the connection kind)
  },
})
const endpoint = await created.json() // endpoint.secret (whsec_…) is shown once
```

- **Test send**: `POST /capture/webhooks/:id/test` (`{ event? }`, default
  `email.delivered`) posts one signed sample event at once and answers the delivery with
  its attempt (status, response code, headers sent). Use it to check the handler and its
  signature verification before any email.
- **Real events**: every event of the simulation (or of `POST
  /capture/messages/:id/events`, or a send to a suppressed address) goes to the endpoints
  whose scope and subscription match. Each delivery is retried 8 times with backoff when
  the receiver fails.
- **Assert on the deliveries** with `GET /capture/webhooks/deliveries?endpointId=…`
  (or `messageId=…`), polled until the delivery is `succeeded`; `GET
  /capture/webhooks/deliveries/:id` has the exact body and headers of every attempt, and
  `POST …/:id/replay` sends it again (`exact` or `resign`).
- Signatures: the `unified` format signs `X-Mailsink-Signature` (HMAC SHA-256 of
  `<timestamp>.<body>` with the secret), `resend` signs as Svix (the `svix` package
  verifies it), `brevo` sends the configured `Authorization`.

`tests/e2e/recipe/webhooks.spec.ts` starts a receiver with `node:http`, sends a test event
and waits for the `email.delivered` delivery of a real send.

## 14. Reading the logs

Every API call (refused ones included) and every SMTP session is logged, which helps when a
test fails on the application side:

- `GET /capture/logs/api` (workspace key): method, path, status, `errorCode`, duration
  and the message ids created, filtered by `status=4xx`, `dialect`, `errorCode`, `path`,
  `messageId`, `since`, `until`, paged with `page` and `pageSize`. `GET
  /capture/logs/api/:id` adds the headers (credentials redacted) and the bodies
  (attachments stripped, long bodies truncated).
- `GET /capture/logs/smtp` and `/capture/logs/smtp/:id`: SMTP sessions with their
  outcome and transcript (AUTH secrets redacted).
- Calls without workspace (an unknown key, a missing header, the Admin API) are read with
  the admin key through `GET /admin/logs/api` and `/admin/logs/api/:id`.

```ts
const logs = await mailsink.capture.get('/capture/logs/api', {
  params: { since, status: '4xx' },
})
const failed = (await logs.json()).data // why the application's send was refused
```

## Running the example

The repository suite starts the production build with a fixed, non-secret admin key
(`E2E_ADMIN_KEY` overrides it) and creates one workspace per worker
(`tests/e2e/recipe/fixtures.ts`):

```sh
pnpm build
pnpm --filter @mailsink/app exec playwright install --with-deps chromium   # once
pnpm --filter @mailsink/app exec playwright test tests/e2e/recipe
```

See [CONTRIBUTING.md](../../CONTRIBUTING.md#end-to-end-tests) for ports and for running
Playwright in its Docker image.
