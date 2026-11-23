import type { Database } from '@mailsink/db'
import type { EventBus } from './bus'

/** What a state-changing service needs to publish its result on the workspace channel. */
export interface LiveDeps {
  db: Database
  bus: EventBus
}
