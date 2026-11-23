import { ListSuppressionsQuery } from '@mailsink/contracts'
import {
  createTestConnection,
  createTestMessage,
  createTestSuppression,
  createTestWorkspace,
  describeDb,
} from '@mailsink/db/testing'
import { beforeEach, expect, it } from 'vitest'
import { listSuppressionViews, resetSuppressions } from './service'

describeDb('suppression service', (ctx) => {
  let workspaceId = ''
  let otherId = ''
  const query = (input: Record<string, unknown> = {}) => ListSuppressionsQuery.parse(input)

  beforeEach(async () => {
    workspaceId = (await createTestWorkspace(ctx.db)).id
    otherId = (await createTestWorkspace(ctx.db)).id
    await createTestSuppression(ctx.db, workspaceId, 'a@x.io')
    await createTestSuppression(ctx.db, workspaceId, 'b_c@x.io', 'complained')
    await createTestSuppression(ctx.db, workspaceId, 'bxc@y.io', 'manual')
    await createTestSuppression(ctx.db, otherId, 'a@x.io')
  })

  it('lists newest first with a keyset cursor, scoped to the workspace', async () => {
    const first = await listSuppressionViews(ctx.db, workspaceId, query({ limit: 2 }))
    expect(first.data.map((s) => s.email)).toEqual(['bxc@y.io', 'b_c@x.io'])
    expect(first.data[0]).toMatchObject({ reason: 'manual', messageId: null })
    const second = await listSuppressionViews(
      ctx.db,
      workspaceId,
      query({ limit: 2, cursor: first.nextCursor }),
    )
    expect(second).toMatchObject({ data: [{ email: 'a@x.io' }], nextCursor: null })
  })

  it('counts every address of the filter and names the connection of the message', async () => {
    const connection = await createTestConnection(ctx.db, workspaceId)
    const message = await createTestMessage(ctx.db, workspaceId, { connectionId: connection.id })
    await createTestSuppression(ctx.db, workspaceId, 'z@x.io', 'hard_bounce', message.id)
    const page = await listSuppressionViews(ctx.db, workspaceId, query({ limit: 1 }))
    expect(page.total).toBe(4)
    expect(page.data[0]).toMatchObject({ email: 'z@x.io', connectionId: connection.id })
    const filtered = await listSuppressionViews(ctx.db, workspaceId, query({ email: 'x.io' }))
    expect(filtered.total).toBe(3)
    expect(filtered.data.at(-1)).toMatchObject({ email: 'a@x.io', connectionId: null })
  })

  it('filters on a literal, case-insensitive substring', async () => {
    const page = await listSuppressionViews(ctx.db, workspaceId, query({ email: 'B_C' }))
    expect(page.data.map((s) => s.email)).toEqual(['b_c@x.io'])
  })

  it('deletes one address or the whole list of the workspace only', async () => {
    expect(await resetSuppressions(ctx.db, workspaceId, 'a@x.io')).toEqual({ count: 1 })
    expect(await resetSuppressions(ctx.db, workspaceId, 'a@x.io')).toEqual({ count: 0 })
    expect(await resetSuppressions(ctx.db, workspaceId)).toEqual({ count: 2 })
    expect((await listSuppressionViews(ctx.db, otherId, query())).data).toHaveLength(1)
  })
})
