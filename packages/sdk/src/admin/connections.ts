import * as C from '@mailsink/contracts'
import { seg, type Transport } from '../http'
import type {
  Connection,
  ConnectionInput,
  CreatedConnection,
  UpdateConnectionInput,
} from '../types'

/** `/admin/workspaces/:ref/connections` (Admin key). `ref` is a workspace id or slug. */
export function connectionsApi(t: Transport) {
  const path = (ref: string, id?: string, suffix = '') =>
    `/admin/workspaces/${seg(ref)}/connections${id ? `/${seg(id)}` : ''}${suffix}`
  return {
    /** Adds a connection; its credentials are answered once. */
    create: (ref: string, input: ConnectionInput) =>
      t.json<CreatedConnection>({
        method: 'POST',
        path: path(ref),
        auth: 'admin',
        body: input,
        schema: C.CreatedConnection,
      }),
    /** Renames, disables (`enabled: false`) or enables a connection. */
    update: (ref: string, connectionId: string, patch: UpdateConnectionInput) =>
      t.json<Connection>({
        method: 'PATCH',
        path: path(ref, connectionId),
        auth: 'admin',
        body: patch,
        schema: C.ConnectionView,
      }),
    /** Hard delete; messages and logs keep a null connection. */
    delete: (ref: string, connectionId: string) =>
      t.json<void>({ method: 'DELETE', path: path(ref, connectionId), auth: 'admin' }),
    /** New `msk_` key or SMTP password, the previous one revoked at once. */
    rotate: (ref: string, connectionId: string) =>
      t.json<CreatedConnection>({
        method: 'POST',
        path: path(ref, connectionId, '/rotate'),
        auth: 'admin',
        schema: C.CreatedConnection,
      }),
  }
}

export type ConnectionsApi = ReturnType<typeof connectionsApi>
