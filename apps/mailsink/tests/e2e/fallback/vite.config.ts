import { cpSync, mkdirSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { lingui } from '@lingui/vite-plugin'
import { defineConfig, type Plugin, type PluginOption } from 'vite'
import appConfig from '../../../vite.config'

// Test-only build of the app with a third, partially translated locale (`de`), to check
// in a browser that a community locale falls back to English (#60). It reuses the app
// config, swaps the Lingui plugin for one reading ./lingui.config.ts, and patches two
// i18n modules at build time. Output goes to ./.output: nothing here ships.

const here = (path: string) => fileURLToPath(new URL(path, import.meta.url))
const appRoot = here('../../..')
const catalogs = here('./.output/catalogs')

// The shipped EN and FR catalogs plus the test locale, in one directory for Lingui.
rmSync(catalogs, { recursive: true, force: true })
for (const locale of ['en', 'fr', 'de']) {
  const source = locale === 'de' ? here('./de.po') : `${appRoot}/src/locales/${locale}/messages.po`
  mkdirSync(`${catalogs}/${locale}`, { recursive: true })
  cpSync(source, `${catalogs}/${locale}/messages.po`)
}

// Exact source snippets to rewrite; the build fails if one is missing, so a refactor of
// these modules shows up here instead of silently testing nothing.
const patches: Record<string, [from: string, to: string][]> = {
  'src/i18n/locales.ts': [
    ["['en', 'fr'] as const", "['en', 'fr', 'de'] as const"],
    ["fr: 'Français',", "fr: 'Français',\n  de: 'Deutsch',"],
  ],
  'src/i18n/lingui.ts': [
    [
      // biome-ignore lint/suspicious/noTemplateCurlyInString: source text of a template literal
      '`../locales/${locale}/messages.po`',
      // biome-ignore lint/suspicious/noTemplateCurlyInString: source text of a template literal
      '`../../tests/e2e/fallback/.output/catalogs/${locale}/messages.po`',
    ],
  ],
}

function testLocale(): Plugin {
  return {
    name: 'mailsink-e2e-test-locale',
    enforce: 'pre',
    transform(code, id) {
      const file = Object.keys(patches).find((suffix) => id.endsWith(suffix))
      if (!file) return
      let patched = code
      for (const [from, to] of patches[file] ?? []) {
        if (!patched.includes(from)) throw new Error(`[e2e] ${file}: snippet not found: ${from}`)
        patched = patched.replace(from, to)
      }
      return { code: patched, map: null }
    },
  }
}

const flatten = (options: PluginOption[]): PluginOption[] =>
  options.flatMap((option) => (Array.isArray(option) ? flatten(option) : [option]))

const isLinguiPlugin = (plugin: PluginOption) =>
  typeof plugin === 'object' &&
  plugin !== null &&
  'name' in plugin &&
  plugin.name.startsWith('vite-plugin-lingui')

export default defineConfig({
  ...appConfig,
  root: appRoot,
  plugins: [
    testLocale(),
    lingui({ configPath: here('./lingui.config.ts'), macroTransform: true }),
    ...flatten(appConfig.plugins ?? []).filter((plugin) => !isLinguiPlugin(plugin)),
  ],
  nitro: { output: { dir: here('./.output/build') } },
})
