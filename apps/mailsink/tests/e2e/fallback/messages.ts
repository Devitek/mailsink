// Messages of the fallback scenario, shared by the test build (vite.config.ts) and the spec.

/** Source text (msgid) of the tagline, left untranslated in the test-only `de` catalog. */
export const TAGLINE_SOURCE = 'Catch every email your app sends, without delivering a single one.'

/**
 * Test-only EN translation of the tagline, written into the EN catalog copy of the fallback
 * build. The shipped EN catalog repeats its msgids, so without it a fallback on the EN
 * catalog and a fallback on the source text would render the same string.
 */
export const TAGLINE_EN_OVERRIDE = 'Catch every email (EN catalog, test build).'

/** The EN catalog with the tagline translated as TAGLINE_EN_OVERRIDE; throws if absent. */
export function overrideEnCatalog(po: string): string {
  const entry = `msgid ${JSON.stringify(TAGLINE_SOURCE)}\nmsgstr `
  const at = po.indexOf(entry)
  if (at < 0) throw new Error(`[e2e] EN catalog: no entry for ${TAGLINE_SOURCE}`)
  const end = po.indexOf('\n', at + entry.length)
  const tail = end < 0 ? '' : po.slice(end)
  return `${po.slice(0, at)}${entry}${JSON.stringify(TAGLINE_EN_OVERRIDE)}${tail}`
}
