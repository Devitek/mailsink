import { describe, expect, it } from 'vitest'
import { StreamEvent, StreamQuery } from './stream'

const newIdLike = (prefix: string) => `${prefix}_0192f3a4-7b1c-7d2e-8f00-1234567890ab`

describe('StreamQuery', () => {
  it('splits comma-separated and repeated types', () => {
    expect(StreamQuery.parse({ types: 'message.created,message.status' }).types).toEqual([
      'message.created',
      'message.status',
    ])
    expect(StreamQuery.parse({ types: ['message.event'] }).types).toEqual(['message.event'])
    expect(StreamQuery.parse({})).toEqual({})
  })

  it('rejects an unknown type', () => {
    expect(StreamQuery.safeParse({ types: 'message.lost' }).success).toBe(false)
  })
})

describe('StreamEvent', () => {
  it('accepts an aggregated status and a workspace deletion', () => {
    const messageId = newIdLike('msg')
    expect(
      StreamEvent.parse({
        type: 'message.status',
        messageId,
        status: 'delivered',
        recipient: null,
      }),
    ).toMatchObject({ type: 'message.status', recipient: null })
    const workspaceId = newIdLike('ws')
    expect(StreamEvent.parse({ type: 'workspace.deleted', workspaceId }).type).toBe(
      'workspace.deleted',
    )
  })

  it('rejects an unknown type', () => {
    expect(StreamEvent.safeParse({ type: 'message.lost' }).success).toBe(false)
  })
})
