import type { MessageDetail } from '@mailsink/contracts'

// Shapes the inbox server functions return (serialisable).

/**
 * What the viewer shows of a `MessageDetail`: free-form `metadata` and the `simulation`
 * snapshot are left out (not shown, and not serializable as typed).
 */
export type ViewerMessage = Omit<MessageDetail, 'metadata' | 'simulation'>

/** The MIME source as text, cut for the page (the download keeps every byte). */
export type RawSource = { text: string; sizeBytes: number; truncated: boolean }
