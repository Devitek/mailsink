// Route data middleware (Starlight `routeMiddleware`): the version banner of every page but
// the landing page (D271, src/banner.ts).
import { defineRouteMiddleware } from '@astrojs/starlight/route-data'
import { versionBanner } from './banner'
import release from './generated/release.json'

export const onRequest = defineRouteMiddleware((context) => {
  const { entry } = context.locals.starlightRoute
  entry.data.banner = versionBanner(entry.data, release.version)
})
