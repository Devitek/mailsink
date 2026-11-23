/** One dispatched Server-Sent Events frame (WHATWG HTML, « Server-sent events »). */
export interface SseFrame {
  data: string
  /** Last event id seen so far on the stream (it persists across frames). */
  lastEventId: string
  /** Whether this frame carried its own `id:` field. */
  hasId: boolean
}

/**
 * Incremental `text/event-stream` parser: push decoded text with `feed`, get the frames
 * completed by it. Comments (`: ping`) are skipped, `retry:` is reported through `onRetry`.
 */
export class SseParser {
  lastEventId = ''
  private buffer = ''
  private data: string[] = []
  private hasId = false

  constructor(private readonly onRetry: (ms: number) => void = () => {}) {}

  feed(text: string): SseFrame[] {
    this.buffer += text
    const frames: SseFrame[] = []
    for (;;) {
      const match = /\r\n|\r|\n/.exec(this.buffer)
      // A trailing `\r` may be the first half of `\r\n`: wait for the next chunk.
      if (!match || (match[0] === '\r' && match.index === this.buffer.length - 1)) break
      const line = this.buffer.slice(0, match.index)
      this.buffer = this.buffer.slice(match.index + match[0].length)
      const frame = this.line(line)
      if (frame) frames.push(frame)
    }
    return frames
  }

  private line(line: string): SseFrame | undefined {
    if (line === '') return this.dispatch()
    if (line.startsWith(':')) return undefined
    const colon = line.indexOf(':')
    const field = colon === -1 ? line : line.slice(0, colon)
    let value = colon === -1 ? '' : line.slice(colon + 1)
    if (value.startsWith(' ')) value = value.slice(1)
    if (field === 'data') this.data.push(value)
    else if (field === 'id' && !value.includes('\0')) {
      this.lastEventId = value
      this.hasId = true
    } else if (field === 'retry' && /^\d+$/.test(value)) this.onRetry(Number(value))
    return undefined
  }

  private dispatch(): SseFrame | undefined {
    const data = this.data
    const hasId = this.hasId
    this.data = []
    this.hasId = false
    if (data.length === 0) return undefined
    return { data: data.join('\n'), lastEventId: this.lastEventId, hasId }
  }
}
