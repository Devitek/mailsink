import { MessageId, TriggerEventRequest } from '@mailsink/contracts'
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { triggerUiEvent } from './events.server'
import { signedIn } from './messages-fns'

/** « Simulate » Opened / Clicked / Hard Bounce of the message viewer (#40, B1-1). */
export const triggerEventFn = createServerFn({ method: 'POST' })
  .middleware([signedIn])
  .validator(
    z.object({ slug: z.string().min(1).max(200), id: MessageId, event: TriggerEventRequest }),
  )
  .handler(({ context, data }) => triggerUiEvent(context.runtime, data.slug, data.id, data.event))
