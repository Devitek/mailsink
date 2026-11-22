import { fileURLToPath } from 'node:url'
import { lingui } from '@lingui/vite-plugin'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import { nitro } from 'nitro/vite'
import { defineConfig } from 'vite'

// The Lingui config lives at the repo root, shared with the `pnpm i18n:*` scripts.
const linguiConfigPath = fileURLToPath(new URL('../../lingui.config.ts', import.meta.url))

export default defineConfig({
  server: { port: 3000 },
  plugins: [
    // Native macro transform (@lingui/native-tools): no Babel or SWC plugin needed, and it
    // runs in the `pre` stage, before the Start compiler and plugin-react.
    lingui({ configPath: linguiConfigPath, macroTransform: true }),
    tanstackStart(),
    nitro(),
    viteReact(),
  ],
})
