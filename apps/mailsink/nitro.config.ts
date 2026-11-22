import { cp } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'nitro'

// SQL migrations of @mailsink/db, copied next to the server entry at build time (#11) and
// found at boot by src/runtime/migrations.ts.
const migrationsSource = fileURLToPath(new URL('../../packages/db/migrations', import.meta.url))

// Merged with the nitro() Vite plugin options. See src/runtime/nitro-plugin.ts (D3).
export default defineConfig({
  plugins: ['./src/runtime/nitro-plugin.ts'],
  hooks: {
    async compiled(nitro) {
      await cp(migrationsSource, join(nitro.options.output.serverDir, 'migrations'), {
        recursive: true,
      })
    },
  },
})
