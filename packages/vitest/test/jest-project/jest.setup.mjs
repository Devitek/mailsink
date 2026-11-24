// One ephemeral workspace per test file (MAILSINK_URL, MAILSINK_ADMIN_KEY) and the matchers.
import { installMailsinkMatchers, useMailsinkWorkspace } from '@devitek/mailsink-vitest/jest'

installMailsinkMatchers()
useMailsinkWorkspace({ workspace: { name: 'Acme Jest' } })
