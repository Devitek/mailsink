import { Trans, useLingui } from '@lingui/react/macro'
import type { LogConnection } from '../../server-fns/logs-types'
import { KIND_LABEL, KIND_TEXT_CLASS } from '../inbox/connection-label'
import { formatLogDate, formatLogTime } from './format'

// Cells shared by the three log tables (#41).

/** Prototype timestamp: faint mono time with milliseconds, full date on hover. */
export function LogTime({ iso, now }: Readonly<{ iso: string; now: number }>) {
  const { i18n } = useLingui()
  return (
    // Server and browser may sit in different time zones: the browser's wins.
    <time
      dateTime={iso}
      title={formatLogDate(iso, i18n.locale)}
      className="text-ms-text-faint"
      suppressHydrationWarning
    >
      {formatLogTime(iso, i18n.locale, now)}
    </time>
  )
}

/** The connection by name, in its kind colour; « Workspace » for an unscoped row. */
export function ConnectionCell({
  id,
  connections,
}: Readonly<{ id: string | null; connections: readonly LogConnection[] | undefined }>) {
  if (!id) {
    return (
      <span className="text-ms-text-faint">
        <Trans>Workspace</Trans>
      </span>
    )
  }
  const connection = connections?.find((c) => c.id === id)
  if (!connection) {
    return (
      <span className="text-ms-text-faint" title={id}>
        <Trans>deleted</Trans>
      </span>
    )
  }
  return (
    <span title={`${KIND_LABEL[connection.kind]} · ${connection.name}`}>
      <span className={KIND_TEXT_CLASS[connection.kind]}>{connection.name}</span>
    </span>
  )
}
