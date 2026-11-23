import { defineConfig } from 'tsdown'

// Published as `@devitek/mailsink-vitest`: one ESM file per entry with its declarations.
// `@devitek/mailsink` (the SDK) and `vitest` stay external; `jest` never loads Vitest.
export default defineConfig({
  entry: {
    index: 'src/index.ts',
    setup: 'src/setup.ts',
    'global-setup': 'src/global-setup.ts',
    jest: 'src/jest.ts',
    matchers: 'src/matchers/index.ts',
  },
  format: 'esm',
  platform: 'node',
  target: 'es2022',
  dts: true,
  clean: true,
  fixedExtension: false,
})
