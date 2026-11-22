import { defineConfig } from '@lingui/conf'
import { formatter } from '@lingui/format-po'

// Lingui configuration (D17, D18). Lives at the repo root so `pnpm i18n:*` runs from
// anywhere; apps/mailsink/vite.config.ts points the Vite plugin at this file.
export default defineConfig({
  // Keep in sync with LOCALES in apps/mailsink/src/i18n/locales.ts.
  locales: ['en', 'fr'],
  sourceLocale: 'en',
  // Community locales fall back to English for entries not translated yet. `pnpm i18n:check`
  // checks EN and FR catalogs before fallbacks (`--mode catalog`), so a missing FR entry
  // still fails CI; other locales never fail it.
  fallbackLocales: { default: 'en' },
  catalogs: [
    {
      path: '<rootDir>/apps/mailsink/src/locales/{locale}/messages',
      include: ['<rootDir>/apps/mailsink/src'],
      exclude: ['**/node_modules/**', '**/*.test.*', '**/routeTree.gen.ts'],
    },
  ],
  // Line numbers churn on every edit; the file reference is enough for translators.
  format: formatter({ lineNumbers: false }),
})
