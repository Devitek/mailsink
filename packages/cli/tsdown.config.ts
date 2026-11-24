import { defineConfig } from 'tsdown'

// Standalone `mailsink` bin, published as @devitek/mailsink-cli. The SDK and the internal
// packages (@mailsink/*) are TypeScript sources and get bundled; zod and the MCP client
// stay external dependencies. `migrate` is a lazy chunk: its database drivers (drizzle-orm,
// pg, PGlite with its WASM assets) are optional peers, never loaded by the piloting
// commands (D251).
export default defineConfig({
  entry: ['src/bin.ts'],
  format: 'esm',
  platform: 'node',
  target: 'node20',
  dts: false,
  clean: true,
  deps: {
    alwaysBundle: [/^@mailsink\//, /^@devitek\/mailsink$/],
  },
  copy: [{ from: '../db/migrations', to: 'dist' }],
})
