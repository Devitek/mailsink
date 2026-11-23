import { describe, expect, it } from 'vitest'
import { createTranscriptRecorder, MAX_TRANSCRIPT_LINES, redactClientLine } from './transcript'

describe('redactClientLine', () => {
  it('masks an AUTH initial response and keeps other lines', () => {
    expect(redactClientLine('AUTH PLAIN AGFsaWNlAHNlY3JldA==')).toBe('AUTH PLAIN /* secured */')
    expect(redactClientLine('AUTH LOGIN')).toBe('AUTH LOGIN')
    expect(redactClientLine('MAIL FROM:<a@example.test>')).toBe('MAIL FROM:<a@example.test>')
  })
})

describe('createTranscriptRecorder', () => {
  it('keeps protocol lines per session, in order, then forgets them', () => {
    const recorder = createTranscriptRecorder(() => 7)
    const { logger } = recorder
    logger.debug({ tnx: 'send', cid: 's1' }, 'S:', '220 mailsink ESMTP')
    logger.debug({ tnx: 'command', cid: 's1' }, 'C:', 'AUTH PLAIN abc')
    logger.debug({ tnx: 'data', cid: 's1' }, 'C: <%s bytes of DATA>', 42)
    logger.info({ tnx: 'data', cid: 's1' }, 'Rejected message of %s bytes', 42)
    logger.info({ tnx: 'close', cid: 's1' }, 'Connection closed to %s', 'x')
    logger.debug({ tnx: 'send', cid: 's2' }, 'S:', '250-a\r\n250 b')

    expect(recorder.take('s1')).toEqual([
      { at: 7, dir: 'S', line: '220 mailsink ESMTP' },
      { at: 7, dir: 'C', line: 'AUTH PLAIN /* secured */' },
      { at: 7, dir: 'C', line: '<42 bytes of DATA>' },
    ])
    expect(recorder.take('s1')).toEqual([])
    expect(recorder.take('s2').map((l) => l.line)).toEqual(['250-a', '250 b'])
  })

  it('caps the transcript and says how many lines were left out', () => {
    const recorder = createTranscriptRecorder()
    for (let i = 0; i < MAX_TRANSCRIPT_LINES + 3; i++) {
      recorder.logger.debug({ tnx: 'command', cid: 's' }, 'C:', `NOOP ${i}`)
    }
    const lines = recorder.take('s')
    expect(lines).toHaveLength(MAX_TRANSCRIPT_LINES + 1)
    expect(lines.at(-1)?.line).toBe('[mailsink] 3 more lines not recorded')
  })
})
