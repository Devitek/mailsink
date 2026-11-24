# @devitek/mailsink-vitest

Vitest and Jest helpers for [Mailsink](https://github.com/Devitek/mailsink), the email sink
for staging and CI: an ephemeral workspace per test file, worker or run, and matchers for
the emails your code sends.

```sh
npm install --save-dev @devitek/mailsink-vitest
```

```ts
// vitest.config.ts: test.setupFiles = ['@devitek/mailsink-vitest/setup']
import { test } from '@devitek/mailsink-vitest'
import { expect } from 'vitest'

test('sends the welcome email', async ({ mailsink }) => {
  await signUp('ada@example.test', mailsink.credentials('resend'))

  await expect(mailsink).toHaveReceivedEmail({ to: 'ada@example.test', subject: 'Welcome' })
  const message = await mailsink.client.messages.waitFor(
    { to: 'ada@example.test' },
    { since: new Date(0) },
  )
  expect(message).toHaveLink('/welcome')
  expect(message).toHaveStatus(['queued', 'delivered'])
})
```

Set `MAILSINK_URL` and `MAILSINK_ADMIN_KEY` (or pass `url` and `adminKey`). Jest, the
worker scope, the global setup and every option: the
[guide](https://mailsink.devitek.fr/guides/vitest-jest/) of the
[Mailsink documentation](https://mailsink.devitek.fr).

Versioned with the Mailsink server. MIT license.
