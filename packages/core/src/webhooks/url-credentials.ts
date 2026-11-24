// Basic auth credentials written in a webhook URL (`https://user:pass@host/…`), as Brevo
// accepts them (#149, proposition D278). `fetch` refuses such a URL, so they are taken out
// at creation (stored as `brevoAuth` basic) and, for a row stored before, at send time.

export interface BasicCredentials {
  username: string
  password: string
}

export interface SplitUrl {
  /** The URL without credentials (unchanged when it had none). */
  url: string
  basic: BasicCredentials | null
}

const decode = (value: string) => {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

/** Takes `user:password@` out of a URL; a URL without credentials is returned as is. */
export function splitUrlCredentials(raw: string): SplitUrl {
  let parsed: URL
  try {
    parsed = new URL(raw)
  } catch {
    return { url: raw, basic: null }
  }
  if (!parsed.username && !parsed.password) return { url: raw, basic: null }
  const basic = { username: decode(parsed.username), password: decode(parsed.password) }
  parsed.username = ''
  parsed.password = ''
  return { url: parsed.href, basic }
}

/** `Authorization: Basic <base64 user:password>`. */
export function basicAuthorization({ username, password }: BasicCredentials): string {
  return `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`
}

/** The URL a view may show: never its credentials. */
export const redactUrl = (url: string): string => splitUrlCredentials(url).url
