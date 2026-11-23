import type { MessageDetail } from '@devitek/mailsink'

type Reload = () => Promise<MessageDetail>

// Messages answered by `expectEmail` remember how to read themselves again, so
// `toHaveStatus` can wait for the simulation instead of checking a stale snapshot.
const sources = new WeakMap<object, Reload>()

export function rememberSource(message: MessageDetail, reload: Reload): void {
  sources.set(message, reload)
}

/** The reload of a message answered by `expectEmail`, `undefined` for any other object. */
export function sourceOf(message: unknown): Reload | undefined {
  return typeof message === 'object' && message !== null ? sources.get(message) : undefined
}
