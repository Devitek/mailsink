import { lookup as dnsLookup } from 'node:dns/promises'
import { BlockList, isIP } from 'node:net'

/**
 * Checks a webhook URL before it is stored or called (`MAILSINK_WEBHOOK_BLOCK_PRIVATE`,
 * D150): resolves to a refusal reason, or null when the URL may be used.
 */
export type UrlGuard = (url: string) => Promise<string | null>

export type HostLookup = (host: string) => Promise<{ address: string; family: number }[]>

const defaultLookup: HostLookup = (host) => dnsLookup(host, { all: true, verbatim: true })

const blocked = new BlockList()
for (const [network, prefix] of [
  ['0.0.0.0', 8], // "this" network
  ['10.0.0.0', 8], // private
  ['100.64.0.0', 10], // carrier-grade NAT
  ['127.0.0.0', 8], // loopback
  ['169.254.0.0', 16], // link-local, cloud metadata
  ['172.16.0.0', 12], // private
  ['192.168.0.0', 16], // private
] as const) {
  blocked.addSubnet(network, prefix, 'ipv4')
}
for (const [network, prefix] of [
  ['::', 128], // unspecified
  ['::1', 128], // loopback
  ['fc00::', 7], // unique local
  ['fe80::', 10], // link-local
] as const) {
  blocked.addSubnet(network, prefix, 'ipv6')
}

/** IPv4 address carried by an IPv4-mapped IPv6 address (`::ffff:a.b.c.d` or hex form). */
function mappedIpv4(address: string): string | null {
  const match = /^::ffff:(.+)$/i.exec(address)
  if (!match?.[1]) return null
  if (isIP(match[1]) === 4) return match[1]
  const hex = /^([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i.exec(match[1])
  if (!hex?.[1] || !hex[2]) return null
  const high = Number.parseInt(hex[1], 16)
  const low = Number.parseInt(hex[2], 16)
  return [high >> 8, high & 255, low >> 8, low & 255].join('.')
}

/** Private, loopback, link-local or unspecified address (IPv4, IPv6, IPv4-mapped). */
export function isBlockedAddress(address: string): boolean {
  const v4 = isIP(address) === 4 ? address : mappedIpv4(address)
  if (v4) return blocked.check(v4, 'ipv4')
  return isIP(address) === 6 && blocked.check(address, 'ipv6')
}

/**
 * Guard refusing URLs whose host is, or resolves to, a blocked address (any of them). A
 * host that does not resolve is let through: the request itself will fail. The check
 * runs at creation and before each attempt; a DNS answer changing between the check and
 * the request (rebinding) is not covered (D155, proposition).
 */
export function privateAddressGuard(lookup: HostLookup = defaultLookup): UrlGuard {
  return async (url) => {
    const host = new URL(url).hostname.replace(/^\[(.*)\]$/, '$1')
    let addresses: string[]
    if (isIP(host)) addresses = [host]
    else {
      try {
        addresses = (await lookup(host)).map((a) => a.address)
      } catch {
        return null
      }
    }
    const refused = addresses.find(isBlockedAddress)
    return refused
      ? `blocked: ${host} resolves to the private, loopback or link-local address ${refused}`
      : null
  }
}
