import { defineConfig } from 'nitro'

// Merged with the nitro() Vite plugin options. See src/runtime/nitro-plugin.ts (D3).
export default defineConfig({
  plugins: ['./src/runtime/nitro-plugin.ts'],
})
