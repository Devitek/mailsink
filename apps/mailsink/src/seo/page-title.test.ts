import { describe, expect, it } from 'vitest'
import { documentTitle, headI18n, pageTitle } from './page-title'

const root = (locale: string, messages: Record<string, string>) => ({
  routeId: '__root__',
  loaderData: { locale, messages },
})
const SIGN_IN = { id: 'sign-in', message: 'Sign in' }

describe('pageTitle', () => {
  it('translates the page name with the catalog of the root loader', () => {
    const matches = [root('fr', { 'sign-in': 'Se connecter' }), { routeId: '/login' }]
    expect(pageTitle(matches, SIGN_IN)).toEqual({ title: 'Se connecter · Mailsink' })
  })

  it('interpolates values', () => {
    const matches = [root('en', { inbox: '{name} inbox' })]
    expect(pageTitle(matches, { id: 'inbox' }, { name: 'Staging' })).toEqual({
      title: 'Staging inbox · Mailsink',
    })
  })

  it('reads the values carried by a msg descriptor', () => {
    const matches = [root('fr', { box: 'Boîte · {slug}' })]
    expect(pageTitle(matches, { id: 'box', values: { slug: 'qa' } })).toEqual({
      title: 'Boîte · qa · Mailsink',
    })
  })

  it('falls back to the source message before the root loader ran', () => {
    expect(pageTitle([{ routeId: '/login' }], SIGN_IN)).toEqual({ title: 'Sign in · Mailsink' })
    expect(headI18n([{ routeId: '__root__', loaderData: { locale: 'xx' } }])).toBeUndefined()
  })

  it('reuses one i18n instance per catalog', () => {
    const matches = [root('en', {})]
    expect(headI18n(matches)).toBe(headI18n(matches))
  })

  it('keeps the bare product name without a page', () => {
    expect(documentTitle()).toBe('Mailsink')
  })
})
