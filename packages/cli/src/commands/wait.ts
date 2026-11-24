// `mailsink wait`: long polls the Capture API until a message matches (exit 3 on timeout).
import { parseArgs } from 'node:util'
import { extractLinks, findLink, type MessageDetail } from '@devitek/mailsink'
import { CLIENT_OPTIONS, type Env, resolveSettings, workspaceClient } from '../config'
import { UsageError } from '../errors'
import { type Io, printJson } from '../output'
import { parseDurationMs, parseSince } from '../parse'

export const DEFAULT_WAIT_TIMEOUT = '10s'

export async function waitCommand(args: string[], env: Env, io: Io): Promise<void> {
  const { values, positionals } = parseArgs({
    args,
    options: {
      ...CLIENT_OPTIONS,
      to: { type: 'string' },
      from: { type: 'string' },
      subject: { type: 'string' },
      tag: { type: 'string' },
      q: { type: 'string' },
      connection: { type: 'string' },
      since: { type: 'string' },
      timeout: { type: 'string', default: DEFAULT_WAIT_TIMEOUT },
      link: { type: 'string' },
    },
    allowPositionals: true,
    strict: true,
  })
  if (positionals.length > 0) {
    throw new UsageError(`mailsink wait: unexpected argument "${positionals[0]}"`)
  }
  const timeout = parseDurationMs(values.timeout, 'timeout')
  const since = parseSince(values.since)
  const client = workspaceClient(resolveSettings(values, env))
  const message = await client.messages.waitFor(
    {
      to: values.to,
      from: values.from,
      subject: values.subject,
      tag: values.tag,
      q: values.q,
      connectionId: values.connection,
    },
    { timeout, since },
  )
  const extractedLinks = extractLinks(message)
  const link = values.link === undefined ? undefined : findLink(message, values.link)
  if (values.link !== undefined && !link) {
    throw new Error(`No link of message ${message.id} contains "${values.link}"`)
  }
  if (values.json) return printJson(io, { ...message, extractedLinks, link })
  io.out(link ?? summary(message, extractedLinks))
}

function summary(message: MessageDetail, links: string[]): string {
  const address = (a: { email: string; name: string | null }) =>
    a.name ? `${a.name} <${a.email}>` : a.email
  return [
    `ID       ${message.id}`,
    `Date     ${message.createdAt}`,
    `From     ${address(message.from)}`,
    `To       ${message.to.map(address).join(', ')}`,
    `Subject  ${message.subject}`,
    `Status   ${message.status}`,
    ...(links.length ? ['Links', ...links.map((url) => `  ${url}`)] : []),
  ].join('\n')
}
