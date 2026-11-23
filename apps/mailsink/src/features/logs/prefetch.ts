import type { LogsSearch } from '@mailsink/contracts'
import type { QueryClient } from '@tanstack/react-query'
import {
  apiLogQuery,
  apiLogsQuery,
  deliveriesQuery,
  deliveryQuery,
  logSourcesQuery,
  smtpSessionQuery,
  smtpSessionsQuery,
} from './queries'
import { apiQueryOf, deliveriesQueryOf, smtpQueryOf, tabOf } from './search-query'

/** A failed read is shown by the page (empty table, « no longer exists »), not an error page. */
const soft = (task: Promise<unknown>) => task.catch(() => undefined)

/** Route loader of the logs explorer: facet sources, the page of the tab, the inspected row. */
export async function prefetchLogs(qc: QueryClient, slug: string, search: LogsSearch) {
  const id = search.inspect
  const tasks: Promise<unknown>[] = [qc.ensureQueryData(logSourcesQuery(slug))]
  switch (tabOf(search)) {
    case 'api':
      tasks.push(soft(qc.ensureQueryData(apiLogsQuery(slug, apiQueryOf(search)))))
      if (id) tasks.push(soft(qc.ensureQueryData(apiLogQuery(slug, id))))
      break
    case 'smtp':
      tasks.push(soft(qc.ensureQueryData(smtpSessionsQuery(slug, smtpQueryOf(search)))))
      if (id) tasks.push(soft(qc.ensureQueryData(smtpSessionQuery(slug, id))))
      break
    case 'webhooks':
      tasks.push(soft(qc.ensureQueryData(deliveriesQuery(slug, deliveriesQueryOf(search)))))
      if (id) tasks.push(soft(qc.ensureQueryData(deliveryQuery(slug, id))))
      break
  }
  await Promise.all(tasks)
}
