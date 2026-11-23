import { UpdateWorkspaceRequest } from '@mailsink/contracts'
import { createTestWorkspace, describeDb } from '@mailsink/db/testing'
import { expect, it } from 'vitest'
import { updateWorkspaceSettings } from './update'

const patch = (input: unknown) => UpdateWorkspaceRequest.parse(input)

describeDb('updateWorkspaceSettings', (ctx) => {
  it('changes only the given settings, null clears the rate limit', async () => {
    const ws = await createTestWorkspace(ctx.db, {
      description: 'kept',
      rateLimit: { limit: 10, windowSeconds: 1 },
    })
    const now = new Date('2026-11-23T10:00:00.000Z')
    const view = await updateWorkspaceSettings(
      ctx.db,
      ws.slug,
      patch({ name: 'QA', retention: '24h' }),
      'https://mail.test',
      now,
    )
    expect(view).toMatchObject({
      slug: ws.slug,
      name: 'QA',
      description: 'kept',
      retentionSeconds: 86_400,
      rateLimit: { limit: 10, windowSeconds: 1 },
    })
    const cleared = await updateWorkspaceSettings(
      ctx.db,
      ws.id,
      patch({ rateLimit: null, description: null }),
      'https://mail.test',
    )
    expect(cleared).toMatchObject({ name: 'QA', rateLimit: null, description: null })
  })

  it('answers not_found for an unknown workspace', async () => {
    await expect(
      updateWorkspaceSettings(ctx.db, 'nope', patch({ name: 'x' }), 'https://mail.test'),
    ).rejects.toMatchObject({ code: 'not_found' })
  })
})
