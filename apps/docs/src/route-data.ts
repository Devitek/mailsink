// Route data middleware (Starlight `routeMiddleware`): every page, the API reference
// included, carries a banner saying the site documents `main`, with the latest release
// (root package.json, bumped by release-please) and its changelog (D271).
import { defineRouteMiddleware } from '@astrojs/starlight/route-data'
import release from './generated/release.json'

const REPO = 'https://github.com/Devitek/mailsink'

export function bannerContent(version: string): string {
  const tag = `v${version}`
  return (
    'This site documents the <code>main</code> branch, which may hold changes not yet ' +
    `released. Latest release: <a href="${REPO}/releases/tag/${tag}">${tag}</a> ` +
    `(<a href="${REPO}/blob/${tag}/CHANGELOG.md">changelog</a>).`
  )
}

export const onRequest = defineRouteMiddleware((context) => {
  const { entry } = context.locals.starlightRoute
  entry.data.banner ??= { content: bannerContent(release.version) }
})
