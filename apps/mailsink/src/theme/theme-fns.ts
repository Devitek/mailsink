import { createServerFn } from '@tanstack/react-start'
import { readRequestTheme, writeThemeCookie } from './theme.server'
import { isTheme, type Theme } from './themes'

// Server functions callable from isomorphic code (root loader, theme toggle). The Start
// compiler strips the handlers, and the theme.server import, from the client.

export const getRequestTheme = createServerFn({ method: 'GET' }).handler(() => readRequestTheme())

export const setTheme = createServerFn({ method: 'POST' })
  .validator((theme: string): Theme => {
    if (!isTheme(theme)) throw new Error('Unsupported theme')
    return theme
  })
  .handler(({ data }) => {
    writeThemeCookie(data)
    return data
  })
