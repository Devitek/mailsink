// Vitest `setupFiles` entry: registers the Mailsink matchers on `expect`.
import { expect } from 'vitest'
import { mailsinkMatchers } from './matchers'
import './vitest-types'

expect.extend(mailsinkMatchers)
