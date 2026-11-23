import { z } from 'zod'
import { MessageId } from './ids'

// `POST /capture/demo` (#62): demo messages for an empty inbox, through the ingestion
// pipeline. The data set exists in the locales of the web UI.

export const DemoLocale = z.enum(['en', 'fr'])

export const SeedDemoRequest = z.object({ locale: DemoLocale.default('en') })

export const SeedDemoResponse = z.object({
  count: z.number().int().min(0),
  /** Ids of the stored messages, oldest first. */
  messageIds: z.array(MessageId),
})

export type DemoLocale = z.output<typeof DemoLocale>
export type SeedDemoRequest = z.output<typeof SeedDemoRequest>
export type SeedDemoResponse = z.output<typeof SeedDemoResponse>
