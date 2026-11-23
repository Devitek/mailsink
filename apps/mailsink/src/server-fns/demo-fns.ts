import { DemoLocale } from '@mailsink/contracts'
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { loadDemoMessages } from './demo.server'
import { signedIn } from './workspaces-fns'

// Demo messages server function (#62), session-checked. The locale is the UI's; a
// community locale without a demo data set falls back to English.

const Slug = z.string().min(1).max(200)

export const loadDemoMessagesFn = createServerFn({ method: 'POST' })
  .middleware([signedIn])
  .validator(z.object({ slug: Slug, locale: DemoLocale }))
  .handler(({ context, data }) => loadDemoMessages(context.runtime, data.slug, data.locale))
