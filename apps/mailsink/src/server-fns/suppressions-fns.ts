import { Email, SuppressionId } from '@mailsink/contracts'
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { readSuppressionsPage, removeSuppressions } from './suppressions.server'
import { signedIn } from './workspaces-fns'

// Suppression list server functions (#42), session-checked, on the core suppression services.

const Slug = z.string().min(1).max(200)

export const listSuppressionsFn = createServerFn({ method: 'GET' })
  .middleware([signedIn])
  .validator(
    z.object({
      slug: Slug,
      email: z.string().max(320).optional(),
      cursor: SuppressionId.optional(),
    }),
  )
  .handler(({ context, data }) =>
    readSuppressionsPage(context.runtime, data.slug, { email: data.email, cursor: data.cursor }),
  )

/** `email` omitted: the whole list. */
export const removeSuppressionsFn = createServerFn({ method: 'POST' })
  .middleware([signedIn])
  .validator(z.object({ slug: Slug, email: Email.optional() }))
  .handler(({ context, data }) => removeSuppressions(context.runtime, data.slug, data.email))
