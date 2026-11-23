// Admin read of the API logs no workspace owns (D151): calls refused before a workspace is
// resolved (unknown key, missing header) and Admin API calls. Reading them is not logged
// (D145).
import { ApiLogParams, ListApiLogsQuery } from '@mailsink/contracts'
import { getApiLogView, listApiLogViews } from '@mailsink/core'
import { defineApi } from '../handler'

/** GET /admin/logs/api: same filters, sort and pagination as /capture/logs/api. */
export const listAdminApiLogsApi = defineApi({
  auth: 'admin',
  query: ListApiLogsQuery,
  handler: ({ runtime, query }) => listApiLogViews(runtime.db.db, null, query),
})

/** GET /admin/logs/api/:id: a row without workspace; a workspace's row is a 404. */
export const getAdminApiLogApi = defineApi({
  auth: 'admin',
  params: ApiLogParams,
  handler: ({ runtime, params }) => getApiLogView(runtime.db.db, null, params.id),
})
