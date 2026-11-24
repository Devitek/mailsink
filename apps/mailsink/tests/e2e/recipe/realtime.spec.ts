import { isMailsinkError, type StreamEvent } from '@devitek/mailsink-playwright'
import { expect, test } from './fixtures'

// Real time on the built server (#81): the SSE stream through the SDK, and wait=true long
// polling. The stream scenario deletes a workspace, so it creates its own.

test('the SSE stream carries messages, statuses, overrides and the deletion', async ({
  mailsinkWorkspace,
}) => {
  const { admin } = mailsinkWorkspace
  const created = await admin.admin.workspaces.create({
    name: 'e2e stream',
    ephemeral: true,
    idleTtlSeconds: 600,
    connections: [{ kind: 'resend', name: 'app' }],
  })
  const sink = admin.with({ key: created.workspaceKey, adminKey: undefined })
  const connection = created.connections[0]
  if (connection?.credentials.kind !== 'resend') throw new Error('no resend connection')
  const events: StreamEvent[] = []
  const subscription = sink.stream.subscribe((event) => {
    events.push(event)
  })
  const ofType = <T extends StreamEvent['type']>(type: T) =>
    events.filter((e): e is Extract<StreamEvent, { type: T }> => e.type === type)
  try {
    await subscription.ready
    const sent = await fetch(`${mailsinkWorkspace.url}/v1/emails`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${connection.credentials.apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        from: 'app@example.com',
        to: 'jane@example.com',
        subject: 'Hi',
        text: 'x',
      }),
    })
    const { id } = (await sent.json()) as { id: string }

    await expect.poll(() => ofType('message.status').length).toBe(1)
    expect(ofType('message.created')[0]).toMatchObject({ message: { id, subject: 'Hi' } })
    expect(ofType('message.status')[0]).toMatchObject({
      messageId: id,
      status: 'delivered',
      recipient: null,
    })
    expect(ofType('message.event').map((e) => e.event.type)).toEqual(['sent', 'delivered'])

    await sink.overrides.activate({ rates: { failed: 100 } })
    await expect.poll(() => ofType('override.changed').length).toBe(1)
    expect(ofType('override.changed')[0]).toMatchObject({
      state: { workspace: { config: { rates: { failed: 100 } } } },
    })

    await admin.admin.workspaces.delete(created.workspace.id)
    // The last frame ends the subscription.
    await subscription.done
    expect(events.at(-1)).toEqual({ type: 'workspace.deleted', workspaceId: created.workspace.id })
  } finally {
    subscription.close()
    await admin.admin.workspaces.delete(created.workspace.id).catch(() => undefined)
  }
})

test('wait=true returns as soon as a message matches, wait_timeout otherwise', async ({
  app,
  mailsink,
}) => {
  const started = Date.now()
  const waiting = mailsink.messages.waitFor({ subject: 'Later' }, { timeout: 15_000 })
  setTimeout(() => {
    void app.send({ to: 'jane@example.com', subject: 'Later', text: 'x' })
  }, 500)
  expect(await waiting).toMatchObject({ subject: 'Later' })
  expect(Date.now() - started).toBeLessThan(10_000)

  const timedOut = await mailsink.messages
    .waitFor({ subject: 'Never' }, { timeout: 300 })
    .catch((e: unknown) => e)
  expect(isMailsinkError(timedOut, 'wait_timeout')).toBe(true)
})
