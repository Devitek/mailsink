import { expect, test } from './fixtures'

// The executable example of docs/guides/e2e.md: send with the app, assert with wait=true,
// force a bounce with an override rule.

const email = (to: string, subject: string) => ({
  from: 'App <app@example.com>',
  to,
  subject,
  text: `Hello ${to}`,
})

test('a sent email is captured and delivered', async ({ mailsink }) => {
  // `since` before the action: wait=true then also finds a message committed before the
  // call arrives (without it, only messages created after the call count).
  const since = new Date().toISOString()
  const id = await mailsink.send(email('jane@example.com', 'Welcome'))

  const res = await mailsink.capture.get('/capture/messages', {
    params: { wait: true, since, to: 'jane@example.com', status: 'delivered', timeout: 10_000 },
  })
  expect(res.status()).toBe(200)
  const { data } = await res.json()
  expect(data).toEqual([expect.objectContaining({ id, subject: 'Welcome', status: 'delivered' })])

  const detail = await (await mailsink.capture.get(`/capture/messages/${id}`)).json()
  expect(detail.text).toBe('Hello jane@example.com')
  expect(detail.events.map((e: { type: string }) => e.type)).toEqual([
    'accepted',
    'sent',
    'delivered',
  ])
})

test('an override rule forces a bounce on matching recipients only', async ({ mailsink }) => {
  const override = await mailsink.capture.post('/capture/override', {
    data: { config: { rules: [{ match: '*+bounce@*', status: 'hard_bounce' }] }, ttl: '10m' },
  })
  expect(override.status()).toBe(200)

  const since = new Date().toISOString()
  const bounced = await mailsink.send(email('jane+bounce@example.com', 'Reset password'))
  const delivered = await mailsink.send(email('bob@example.com', 'Reset password'))

  const res = await mailsink.capture.get('/capture/messages', {
    params: { wait: true, since, status: 'hard_bounce', timeout: 10_000 },
  })
  const { data } = await res.json()
  expect(data.map((m: { id: string }) => m.id)).toEqual([bounced])

  const other = await mailsink.capture.get('/capture/messages', {
    params: { wait: true, since, status: 'delivered', timeout: 10_000 },
  })
  expect((await other.json()).data.map((m: { id: string }) => m.id)).toEqual([delivered])

  // The hard bounce joined the suppression list (emptied again by the fixture reset).
  const suppressions = await (await mailsink.capture.get('/capture/suppressions')).json()
  expect(suppressions.data).toEqual([
    expect.objectContaining({ email: 'jane+bounce@example.com', reason: 'hard_bounce' }),
  ])
})

test('each test starts from a blank workspace', async ({ mailsink }) => {
  const list = await (await mailsink.capture.get('/capture/messages')).json()
  expect(list.data).toEqual([])
  const state = await (await mailsink.capture.get('/capture/override')).json()
  expect(state).toMatchObject({ workspace: null, connections: [] })
})
