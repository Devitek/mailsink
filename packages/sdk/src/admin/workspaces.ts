import * as C from '@mailsink/contracts'
import { seg, type Transport } from '../http'
import type { QueryValue } from '../query'
import type {
  CreateWorkspaceInput,
  CreateWorkspaceResult,
  ListWorkspacesParams,
  RotatedWorkspaceKey,
  UpdateWorkspaceInput,
  Workspace,
  WorkspaceDetail,
  WorkspacePage,
} from '../types'

/** `/admin/workspaces` (Admin key). `ref` is a workspace id or slug. */
export function workspacesApi(t: Transport) {
  const path = (ref: string, suffix = '') => `/admin/workspaces/${seg(ref)}${suffix}`
  return {
    /** Creates a workspace, persistent or ephemeral, with its connections; secrets once. */
    create: (input: CreateWorkspaceInput) =>
      t.json<CreateWorkspaceResult>({
        method: 'POST',
        path: '/admin/workspaces',
        auth: 'admin',
        body: input,
        schema: C.CreateWorkspaceResponse,
      }),
    /** One page, persistent workspaces only unless `includeEphemeral`. */
    list: (params: ListWorkspacesParams = {}) =>
      t.json<WorkspacePage>({
        method: 'GET',
        path: '/admin/workspaces',
        auth: 'admin',
        query: params as Record<string, QueryValue>,
        schema: C.ListWorkspacesResponse,
      }),
    get: (ref: string) =>
      t.json<WorkspaceDetail>({
        method: 'GET',
        path: path(ref),
        auth: 'admin',
        schema: C.WorkspaceDetail,
      }),
    update: (ref: string, patch: UpdateWorkspaceInput) =>
      t.json<Workspace>({
        method: 'PATCH',
        path: path(ref),
        auth: 'admin',
        body: patch,
        schema: C.WorkspaceView,
      }),
    /** Immediate hard delete: messages, logs and keys go with it. */
    delete: (ref: string) => t.json<void>({ method: 'DELETE', path: path(ref), auth: 'admin' }),
    /** New `mskw_` key, every previous one revoked at once (D207). */
    rotateKey: (ref: string) =>
      t.json<RotatedWorkspaceKey>({
        method: 'POST',
        path: path(ref, '/key/rotate'),
        auth: 'admin',
        schema: C.RotatedWorkspaceKey,
      }),
  }
}

export type WorkspacesApi = ReturnType<typeof workspacesApi>
