// Version banner of the site (D271): the site documents `main`, with the latest release
// (root package.json, bumped by release-please) and its changelog. Every page carries it,
// API reference included, except the landing page (splash template, D271 adjusted, #153).

const REPO = 'https://github.com/Devitek/mailsink'

export function bannerContent(version: string): string {
  const tag = `v${version}`
  return (
    'This site documents the <code>main</code> branch, which may hold changes not yet ' +
    `released. Latest release: <a href="${REPO}/releases/tag/${tag}">${tag}</a> ` +
    `(<a href="${REPO}/blob/${tag}/CHANGELOG.md">changelog</a>).`
  )
}

/** The banner of a page, or undefined for the landing page (or a page with its own). */
export function versionBanner(
  data: { template?: string; banner?: { content: string } },
  version: string,
): { content: string } | undefined {
  if (data.banner) return data.banner
  return data.template === 'splash' ? undefined : { content: bannerContent(version) }
}
