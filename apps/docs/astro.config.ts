// Documentation website (D265): Astro Starlight, served at the root of mailsink.devitek.fr
// by GitHub Pages. Content comes from the repository Markdown (`scripts/sync.ts`, D266).
import { fileURLToPath } from 'node:url'
import starlight from '@astrojs/starlight'
import { defineConfig } from 'astro/config'
import starlightLinksValidator from 'starlight-links-validator'
import starlightOpenAPI, { openAPISidebarGroups } from 'starlight-openapi'
import { buildChecks } from './src/integrations/build-checks'
import { mermaid } from './src/integrations/mermaid'

const path = (relative: string) => fileURLToPath(new URL(relative, import.meta.url))

export default defineConfig({
  // Custom domain at the root: no `base`, so every link is root-relative (D268).
  site: 'https://mailsink.devitek.fr',
  trailingSlash: 'always',
  // Mermaid ships its layout engines (elk, cytoscape) and KaTeX as chunks over 500 kB; the
  // page script loads Mermaid only where a diagram is, and Mermaid each of them only for a
  // diagram that needs it (D270). The dev server pre-bundles Mermaid, so a page's first
  // load does not find it outdated (504) once Vite discovers the dynamic import.
  vite: { build: { chunkSizeWarningLimit: 2000 }, optimizeDeps: { include: ['mermaid'] } },
  integrations: [
    mermaid(path('../../docs/design/brand-1/tokens/tokens.css')),
    starlight({
      title: 'mailsink',
      description: 'Every email caught. None delivered. The sandbox for your transactional email.',
      logo: { src: '../../docs/design/brand-1/logo/svg/mark.svg', alt: '' },
      // Copied from the brand folder by the sync (D274).
      favicon: '/favicon.svg',
      routeMiddleware: './src/route-data.ts',
      social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/Devitek/mailsink' }],
      customCss: [
        '@fontsource/geist/400.css',
        '@fontsource/geist/500.css',
        '@fontsource/geist/600.css',
        '@fontsource/jetbrains-mono/400.css',
        '../../docs/design/brand-1/tokens/tokens.css',
        './src/styles/brand.css',
        './src/styles/mermaid.css',
      ],
      expressiveCode: {
        styleOverrides: {
          borderRadius: 'var(--ms-radius-md)',
          codeFontFamily: 'var(--ms-font-mono)',
          uiFontFamily: 'var(--ms-font-sans)',
        },
      },
      plugins: [
        starlightOpenAPI([
          {
            base: 'api',
            schema: './src/generated/openapi.json',
            sidebar: { label: 'API reference', operations: { badges: true } },
          },
        ]),
        // Fails the build on a broken internal link or hash (D269). The guides point to a
        // local instance (`http://localhost:3000`) on purpose. The API reference pages are
        // routes injected by starlight-openapi, unknown to the validator: links to them are
        // checked on the built files by build-checks (D272).
        starlightLinksValidator({ errorOnLocalLinks: false, exclude: ['/api/', '/api/**'] }),
      ],
      sidebar: [
        { label: 'Getting started', slug: 'getting-started' },
        { label: 'Guides', items: [{ autogenerate: { directory: 'guides' } }] },
        ...openAPISidebarGroups,
        {
          label: 'Architecture',
          collapsed: true,
          items: [{ autogenerate: { directory: 'architecture' } }],
        },
        { label: 'Contributing', items: [{ autogenerate: { directory: 'contributing' } }] },
      ],
    }),
    buildChecks(path('./src/generated/diagrams.json')),
  ],
})
