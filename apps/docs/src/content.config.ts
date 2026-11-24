import { defineCollection } from 'astro:content'
import { docsLoader, i18nLoader } from '@astrojs/starlight/loaders'
import { docsSchema, i18nSchema } from '@astrojs/starlight/schema'

export const collections = {
  docs: defineCollection({ loader: docsLoader(), schema: docsSchema() }),
  // English only (D265): no UI string overrides yet, but Starlight looks the collection up.
  i18n: defineCollection({ loader: i18nLoader(), schema: i18nSchema() }),
}
