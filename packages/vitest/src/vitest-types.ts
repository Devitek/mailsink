// Types of the matchers and of the global setup value, for Vitest (5+).
import 'vitest'
import type { MailsinkMatchers } from './matchers'
import type { MailsinkWorkspaceData } from './workspace'

declare module 'vitest' {
  interface Matchers<R, T> extends MailsinkMatchers<R> {}
  interface ProvidedContext {
    /** The workspace created by `@devitek/mailsink-vitest/global-setup`. */
    mailsink: MailsinkWorkspaceData
  }
}
