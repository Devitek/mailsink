import { defineConfig } from 'tsdown'

// Published as `@devitek/mailsink`: one ESM entry with its declarations, for Node and
// browsers. The contracts (`@mailsink/contracts`, private) are bundled into both the code
// and the declarations; `zod` stays an external dependency.
export default defineConfig({
  entry: ['src/index.ts'],
  format: 'esm',
  platform: 'neutral',
  target: 'es2022',
  dts: { tsconfig: 'tsconfig.build.json' },
  clean: true,
  deps: {
    alwaysBundle: [/^@mailsink\//],
  },
})
