// Documentation website (D265): Astro Starlight, served at the root of mailsink.devitek.fr
// by GitHub Pages. Content comes from the repository Markdown (`scripts/sync.ts`, D266).
import starlight from '@astrojs/starlight'
import { defineConfig } from 'astro/config'
import starlightLinksValidator from 'starlight-links-validator'
import starlightOpenAPI, { openAPISidebarGroups } from 'starlight-openapi'

export default defineConfig({
  // Custom domain at the root: no `base`, so every link is root-relative (D268).
  site: 'https://mailsink.devitek.fr',
  trailingSlash: 'always',
  integrations: [
    starlight({
      title: 'mailsink',
      description: 'Every email caught. None delivered. The sandbox for your transactional email.',
      logo: { src: '../../docs/design/brand-1/logo/svg/mark.svg', alt: '' },
      favicon: '/favicon.svg',
      social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/Devitek/mailsink' }],
      customCss: [
        '@fontsource/geist/400.css',
        '@fontsource/geist/500.css',
        '@fontsource/geist/600.css',
        '@fontsource/jetbrains-mono/400.css',
        '../../docs/design/brand-1/tokens/tokens.css',
        './src/styles/brand.css',
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
        // routes injected by starlight-openapi, unknown to the validator.
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
  ],
})
