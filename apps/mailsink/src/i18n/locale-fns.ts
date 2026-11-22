import { createServerFn } from '@tanstack/react-start'
import { readRequestLocale, writeLocaleCookie } from './locale.server'
import { isLocale, type Locale } from './locales'

// Server functions callable from isomorphic code (route loaders, the locale switcher).
// The Start compiler strips the handlers, and the locale.server import, from the client.

export const getRequestLocale = createServerFn({ method: 'GET' }).handler(() => readRequestLocale())

export const setLocale = createServerFn({ method: 'POST' })
  .validator((locale: string): Locale => {
    if (!isLocale(locale)) throw new Error('Unsupported locale')
    return locale
  })
  .handler(({ data }) => {
    writeLocaleCookie(data)
    return data
  })
