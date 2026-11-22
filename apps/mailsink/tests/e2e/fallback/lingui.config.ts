import { defineConfig } from '@lingui/conf'
import base from '../../../../../lingui.config'

// Lingui config of the fallback build only (see vite.config.ts next to it): the shipped
// locales plus a test-only community locale, `de`. `<rootDir>` is this directory; the
// catalogs are copied into .output/catalogs by vite.config.ts before the build.
export default defineConfig({
  ...base,
  locales: [...base.locales, 'de'],
  catalogs: [
    {
      path: '<rootDir>/.output/catalogs/{locale}/messages',
      include: ['<rootDir>/../../../src'],
    },
  ],
})
