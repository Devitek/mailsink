# Vitest and Jest helpers (`@devitek/mailsink-vitest`)

`@devitek/mailsink-vitest` brings Mailsink into integration tests that run outside a
browser: an ephemeral workspace per test file (or per worker, or per run) and matchers
for the emails your code sends. It is built on the [TypeScript SDK](sdk.md). Decisions:
D245 to D249.

## Package

| Entry | For | Content |
|---|---|---|
| `@devitek/mailsink-vitest` | Vitest | `test` with a `mailsink` fixture, `createMailsinkTest`, `injectMailsink`, the matchers and the workspace helpers |
| `@devitek/mailsink-vitest/setup` | Vitest `setupFiles` | registers the matchers (`expect.extend`) |
| `@devitek/mailsink-vitest/global-setup` | Vitest `globalSetup` | one workspace for the whole run |
| `@devitek/mailsink-vitest/jest` | Jest | `useMailsinkWorkspace`, `mailsinkWorkspace`, `installMailsinkMatchers`, the matchers |
| `@devitek/mailsink-vitest/matchers` | any runner | `mailsinkMatchers`, for `expect.extend` |

ESM only, Node 20+, Vitest 5+ (optional peer dependency: the Jest and matcher entries
never load Vitest). Versioned with the server, like the SDK.

The helpers read the instance from the environment unless you pass `url` and `adminKey`:

```sh
MAILSINK_URL=http://localhost:3000
MAILSINK_ADMIN_KEY=...   # the server's MAILSINK_ADMIN_KEY: creating workspaces is an admin call
```

## The workspace

Every helper creates its workspace with `createEphemeralWorkspace(options)`:

- always `ephemeral: true`, so the server purges it after its idle TTL even when a run
  dies before its teardown;
- default name `Tests` and one Resend connection named `Test`; `options.workspace` takes
  any field of `CreateWorkspaceInput` (`name`, `connections`, `simulation`...);
- `metadata.createdBy` is `@devitek/mailsink-vitest`, shown by the ephemeral banner.

The handle (`MailsinkWorkspace`) carries `url`, `workspace` (id, slug, urls...),
`workspaceKey`, `connections` (with their secrets), `client` (an SDK client scoped to the
workspace), `credentials(kind?)` (the secrets of the first connection of that kind) and
`dispose()` (deletes the workspace, once, ignoring a workspace already gone).

Give the credentials to the code under test the way it reads them in production:

```ts
const { apiKey, baseUrl } = mailsink.credentials('resend')
const app = createApp({ resend: new Resend(apiKey, { baseUrl }) })
```

## Vitest

`vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    setupFiles: ['@devitek/mailsink-vitest/setup'],
  },
})
```

### A workspace per test file

The `test` of the package has a `mailsink` fixture: the workspace is created the first time
a test of the file uses it and deleted after the last one. Tests of a file share it, so
they run one after the other (the default) and assert on what they sent.

```ts
import { test } from '@devitek/mailsink-vitest'
import { expect } from 'vitest'
import { createApp } from '../src/app'

test('sends the welcome email', async ({ mailsink }) => {
  const app = createApp({ mail: mailsink.credentials('resend') })
  await app.signUp({ email: 'ada@example.test', name: 'Ada' })

  await expect(mailsink).toHaveReceivedEmail({ to: 'ada@example.test', subject: 'Welcome' })
  const message = await mailsink.client.messages.waitFor(
    { to: 'ada@example.test' },
    { since: new Date(0) },
  )
  expect(message).toHaveLink('/welcome')
})
```

Options, or a function read when the fixture starts (after the `beforeAll` hooks, handy
when a hook starts the server):

```ts
import { createMailsinkTest } from '@devitek/mailsink-vitest'

export const test = createMailsinkTest({
  workspace: { name: 'Acme billing', connections: [{ kind: 'brevo', name: 'Billing' }] },
})
```

Fixtures with a file or worker scope must be declared at the top level of a module, not
inside a `describe`. To add your own fixtures, extend the returned `test`
(`test.extend(...)`).

### A workspace per worker

```ts
export const test = createMailsinkTest({}, 'worker')
```

Vitest runs each test file in its own worker by default (`isolate: true`), which makes a
worker scope behave like a file scope; with `isolate: false` the files of a worker share
the workspace. Purge between files if they must not see each other's messages
(`mailsink.client.messages.purge()`).

### One workspace for the run

```ts
export default defineConfig({
  test: {
    globalSetup: ['@devitek/mailsink-vitest/global-setup'],
    setupFiles: ['@devitek/mailsink-vitest/setup'],
  },
})
```

```ts
import { injectMailsink } from '@devitek/mailsink-vitest'

const mailsink = injectMailsink() // client, credentials, workspaceKey...
```

The global setup runs in the main process: it creates the workspace, hands its data to the
tests through `provide`, and deletes it at teardown. For other options, write your own
global setup file:

```ts
// mailsink.global-setup.ts
import { mailsinkGlobalSetup } from '@devitek/mailsink-vitest'

export default mailsinkGlobalSetup({ workspace: { name: 'Acme CI' } })
```

## Jest

Jest loads the package as ESM: run it with `node --experimental-vm-modules` (Jest's
[ECMAScript modules](https://jestjs.io/docs/ecmascript-modules) support).

```js
// jest.config.mjs
export default {
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.mjs'],
}
```

```js
// jest.setup.mjs: runs in every test file
import { installMailsinkMatchers, useMailsinkWorkspace } from '@devitek/mailsink-vitest/jest'

installMailsinkMatchers()
useMailsinkWorkspace({ workspace: { name: 'Acme Jest' } })
```

`useMailsinkWorkspace` registers a `beforeAll` that creates the workspace and an `afterAll`
that deletes it: one workspace per test file. Read it in the tests:

```js
import { mailsinkWorkspace } from '@devitek/mailsink-vitest/jest'

test('sends the welcome email', async () => {
  const mailsink = mailsinkWorkspace()
  await signUp('ada@example.test', mailsink.credentials('resend'))
  await expect(mailsink).toHaveReceivedEmail({ to: 'ada@example.test' })
})
```

Called at the top of a single test file instead, `useMailsinkWorkspace()` answers the
handle directly. Outside Jest globals, pass the hooks:
`useMailsinkWorkspace(options, { beforeAll, afterAll })`.

Types: the package exports the signatures as `MailsinkMatchers<R>`. With `@jest/globals`:

```ts
// mailsink-matchers.d.ts
import type { MailsinkMatchers } from '@devitek/mailsink-vitest/jest'

declare module 'expect' {
  interface Matchers<R extends void | Promise<void>, T = unknown> extends MailsinkMatchers<R> {}
}
```

With `@types/jest`:

```ts
declare global {
  namespace jest {
    interface Matchers<R> extends MailsinkMatchers<R> {}
  }
}
```

Vitest needs nothing: the package augments its `Matchers`.

## Matchers

| Matcher | Received | Passes when |
|---|---|---|
| `await toHaveReceivedEmail(filters?, { timeout?, since? })` | a client or a workspace handle | a message of the workspace matches `filters`, within `timeout` (default 5 s) |
| `toHaveStatus(status \| status[], { recipient? })` | a message | its status (or the status of `recipient`) is one of them |
| `toHaveLink(matcher?)` | a message | it has a link matching a substring, a RegExp or `(url: URL) => boolean`; any link without matcher |

- `toHaveReceivedEmail` takes the filters of `messages.list`: `to`, `from`, `subject`
  (substrings), `tag`, `status`, `connectionId`, `q`. Every message of the workspace counts,
  including those that arrived before the assertion (unlike `messages.waitFor`, which only
  counts messages after the call unless given `since`). Always `await` it.
- `.not.toHaveReceivedEmail` checks once and does not wait.
- On failure, `toHaveReceivedEmail` lists the latest messages of the workspace and
  `toHaveLink` the links of the message.
- A status that comes later (simulated delivery, bounce) is asserted with a status filter:
  `await expect(mailsink).toHaveReceivedEmail({ to, status: ['hard_bounce'] })`.
- `toHaveStatus` and `toHaveLink` read a message as `messages.get` or `messages.waitFor`
  answer it (`toHaveStatus` also reads the summaries of `messages.list`).

```ts
const message = await mailsink.client.messages.waitFor({ to: 'grace@example.test' })
expect(message).toHaveStatus(['queued', 'delivered'])
expect(message).toHaveLink(/\/reset\?token=/)
expect(message).not.toHaveLink((url) => url.hostname !== 'app.example.com')
```

## Tests of the package

`packages/vitest/test/` runs the helpers against the real HTTP routes on a loopback port
(the SDK harness), on PGlite and Postgres, and runs the Jest example project
`test/jest-project/` with Jest itself (the Jest entry bundled first, as published).
