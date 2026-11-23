// Demo messages (03-contracts, « Capture », #62): workspace scope auth (D12, D41).
import { SeedDemoRequest } from '@mailsink/contracts'
import { seedDemoMessages } from '@mailsink/core'
import { defineApi } from '../handler'

/** POST /capture/demo: the demo data set, through the ingestion pipeline. */
export const seedDemoApi = defineApi({
  auth: 'workspace',
  body: SeedDemoRequest,
  handler: async ({ runtime, auth, body }) => {
    const seeded = await seedDemoMessages(
      { db: runtime.db.db, maxMessageBytes: runtime.config.maxMessageBytes, bus: runtime.bus },
      auth.workspace.id,
      body.locale,
    )
    return Response.json(seeded, { status: 201 })
  },
})
