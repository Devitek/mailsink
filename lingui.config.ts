import { defineConfig } from '@lingui/conf'
import { formatter } from '@lingui/format-po'

// Lingui configuration (D17, D18). Lives at the repo root so `pnpm i18n:*` runs from
// anywhere; apps/mailsink/vite.config.ts points the Vite plugin at this file.
export default defineConfig({
  // Keep in sync with LOCALES in apps/mailsink/src/i18n/locales.ts.
  locales: ['en', 'fr'],
  sourceLocale: 'en',
  // No fallback chain: a missing FR entry must fail `pnpm i18n:check`, not hide behind EN.
  fallbackLocales: false,
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
