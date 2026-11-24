import { defineConfig } from 'tsdown'

// Published as `@devitek/mailsink-playwright`: one ESM entry with its declarations, for the
// Playwright runner (Node). `@devitek/mailsink` and `@playwright/test` stay external.
export default defineConfig({
  entry: ['src/index.ts'],
  format: 'esm',
  platform: 'node',
  target: 'es2022',
  fixedExtension: false,
  dts: true,
  clean: true,
})
