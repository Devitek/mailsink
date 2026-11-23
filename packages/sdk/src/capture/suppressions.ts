import * as C from '@mailsink/contracts'
import type { Transport } from '../http'
import type { QueryValue } from '../query'
import type { DeleteSuppressionsResult, ListSuppressionsParams, SuppressionPage } from '../types'

/** `/capture/suppressions`: addresses listed after a hard bounce or a complaint. */
export function suppressionsApi(t: Transport) {
  const remove = (email?: string) =>
    t.json<DeleteSuppressionsResult>({
      method: 'DELETE',
      path: '/capture/suppressions',
      auth: 'workspace',
      query: { email },
      schema: C.DeleteSuppressionsResponse,
    })
  return {
    /** Newest first; `email` is a case-insensitive substring. */
    list: (params: ListSuppressionsParams = {}) =>
      t.json<SuppressionPage>({
        method: 'GET',
        path: '/capture/suppressions',
        auth: 'workspace',
        query: params as Record<string, QueryValue>,
        schema: C.ListSuppressionsResponse,
      }),
    /** Removes one address (exact match); `{ count }`. */
    delete: (email: string) => remove(email),
    /** Empties the whole list of the workspace; `{ count }`. */
    clear: () => remove(),
  }
}

export type SuppressionsApi = ReturnType<typeof suppressionsApi>
