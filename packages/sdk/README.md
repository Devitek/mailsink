# @devitek/mailsink

TypeScript SDK for [Mailsink](https://github.com/Devitek/mailsink), the email sink for
staging and CI: create workspaces, wait for the emails your application sends, read their
links and one-time codes, force bounces, follow the live stream.

- Typed end to end from the server contracts (Zod), inputs and outputs.
- Plain `fetch`, ESM, no Node-only API: Node 20+ and browsers.
- Versioned with the Mailsink server: SDK `x.y.z` matches server `x.y.z`.

## Install

```sh
npm install @devitek/mailsink
```

## Quick start

```ts
import { createMailsink, findLink } from '@devitek/mailsink'

const mailsink = createMailsink({
  url: 'http://localhost:3000',
  key: process.env.MAILSINK_KEY, // workspace key (mskw_…)
})

// Start waiting *before* the action that sends the email.
const email = mailsink.messages.waitFor({ to: 'jane@example.com', subject: 'Welcome' })
await signUp('jane@example.com')
const message = await email // the full message: html, text, links, attachments, events…
console.log(message.subject, findLink(message, '/verify'))
```

`waitFor` only matches messages created after `since`, which defaults to the moment
`waitFor` is called. Call it before the action (and await it after), or pass the `since`
you took before the action:

```ts
const since = new Date()
await signUp('jane@example.com')
const message = await mailsink.messages.waitFor({ to: 'jane@example.com' }, { since })
```

## Recipes

### Magic link

```ts
const email = mailsink.messages.waitFor({ to: 'jane@example.com', subject: 'Sign in' })
await page.getByRole('button', { name: 'Email me a link' }).click()
const link = findLink(await email, '/auth/magic') // string, RegExp or (url: URL) => boolean
await page.goto(link!)
```

### One-time code

```ts
import { extractCode } from '@devitek/mailsink'

const email = mailsink.messages.waitFor({ to: 'jane@example.com' })
await requestCode('jane@example.com')
const code = extractCode(await email) // first 6-digit code: subject, text, then HTML
const pin = extractCode(await email, { length: 4 })
const custom = extractCode(await email, { pattern: /code: ([A-Z0-9-]+)/ })
```

### Bounce with an override

```ts
const rules = [{ match: 'bounce@example.com', status: 'hard_bounce' as const }]
await mailsink.overrides.with({ rules }, async () => {
  const since = new Date()
  await sendInvoice('bounce@example.com')
  const bounced = await mailsink.messages.waitFor(
    { to: 'bounce@example.com', status: ['hard_bounce'] },
    { since, timeout: 15_000 },
  )
}) // the override is reset here, even when the callback throws
```

### One ephemeral workspace per test run

```ts
const admin = createMailsink({ url, adminKey: process.env.MAILSINK_ADMIN_KEY })
const created = await admin.admin.workspaces.create({
  name: 'CI run',
  ephemeral: true,
  connections: [{ kind: 'resend', name: 'App' }],
})
const mailsink = admin.with({ key: created.workspaceKey })
// give created.connections[0].credentials to the application under test
await admin.admin.workspaces.delete(created.workspace.id) // at the end
```

### Live stream

```ts
const subscription = mailsink.stream.subscribe(
  (event) => {
    if (event.type === 'message.created') console.log(event.message.subject)
  },
  { types: ['message.created', 'message.status'] },
)
await subscription.ready
// … reconnects by itself with Last-Event-ID when the connection drops
subscription.close()
```

## Errors

Every failure is a `MailsinkError` with a stable `code` (`not_found`, `validation_error`,
`wait_timeout`, `unauthorized`, `rate_limited`, `network_error`, `invalid_response`…), the
HTTP `status`, the `requestId` to find the call in the request log, and `details`.

```ts
import { isMailsinkError } from '@devitek/mailsink'

try {
  await mailsink.messages.waitFor({ to: 'nobody@example.com' }, { timeout: 2_000 })
} catch (error) {
  if (isMailsinkError(error, 'wait_timeout')) console.log('no email', error.requestId)
  else throw error
}
```

## Reference

The full API (every namespace, options, the stream and the helpers) is described in the
[SDK guide](https://github.com/Devitek/mailsink/blob/main/docs/guides/sdk.md).

## License

MIT
