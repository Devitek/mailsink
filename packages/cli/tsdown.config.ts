import { defineConfig } from 'tsdown'

// Standalone `mailsink` bin. Internal packages (@mailsink/*) are TypeScript sources and get
// bundled; their runtime dependencies (drizzle-orm, pg, PGlite with its WASM assets) stay
// external and are installed as dependencies of this package.
export default defineConfig({
  entry: ['src/bin.ts'],
  format: 'esm',
  platform: 'node',
  target: 'node24',
  dts: false,
  clean: true,
  deps: {
    alwaysBundle: [/^@mailsink\//],
  },
  copy: [{ from: '../db/migrations', to: 'dist' }],
})
