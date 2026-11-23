import { expect, it } from 'vitest'
import { countMessagesByWorkspace } from '../src/repositories/workspace-message-counts'
import { createTestMessage, createTestWorkspace, describeDb } from '../src/testing'

describeDb('countMessagesByWorkspace', (ctx) => {
  it('counts the messages of each workspace asked for, in one aggregated read', async () => {
    const a = await createTestWorkspace(ctx.db)
    const b = await createTestWorkspace(ctx.db)
    const empty = await createTestWorkspace(ctx.db)
    await createTestMessage(ctx.db, a.id)
    await createTestMessage(ctx.db, a.id)
    await createTestMessage(ctx.db, b.id)
    const counts = await countMessagesByWorkspace(ctx.db, [a.id, empty.id])
    expect(counts).toEqual(new Map([[a.id, 2]]))
    expect(counts.get(empty.id) ?? 0).toBe(0)
  })

  it('reads nothing for an empty list', async () => {
    expect(await countMessagesByWorkspace(ctx.db, [])).toEqual(new Map())
  })
})
