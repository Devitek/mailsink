// Suppression list API (03-contracts, « Capture »): workspace scope auth (D12, D41).
import { DeleteSuppressionsQuery, ListSuppressionsQuery } from '@mailsink/contracts'
import { listSuppressionViews, resetSuppressions } from '@mailsink/core'
import { defineApi } from '../handler'

/** GET /capture/suppressions: newest first, `email` substring filter, keyset cursor. */
export const listSuppressionsApi = defineApi({
  auth: 'workspace',
  query: ListSuppressionsQuery,
  handler: ({ runtime, auth, query }) =>
    listSuppressionViews(runtime.db.db, auth.workspace.id, query),
})

/** DELETE /capture/suppressions[?email=]: one address, or the whole list. */
export const deleteSuppressionsApi = defineApi({
  auth: 'workspace',
  query: DeleteSuppressionsQuery,
  handler: ({ runtime, auth, query }) =>
    resetSuppressions(runtime.db.db, auth.workspace.id, query.email),
})
