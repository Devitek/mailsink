import type { DemoLocale, SeedDemoResponse } from '@mailsink/contracts'
import { seedDemoMessages } from '@mailsink/core'
import type { Runtime } from '../runtime/container'
import { workspaceOfSlug } from './messages.server'

// « Load demo messages » of the empty inbox (#62): the core demo seeder, like
// `POST /capture/demo`, on the workspace of the URL (by slug, activity touched).

export async function loadDemoMessages(
  runtime: Runtime,
  slug: string,
  locale: DemoLocale,
): Promise<SeedDemoResponse> {
  const { id } = await workspaceOfSlug(runtime, slug)
  const deps = {
    db: runtime.db.db,
    maxMessageBytes: runtime.config.maxMessageBytes,
    bus: runtime.bus,
  }
  return seedDemoMessages(deps, id, locale)
}
