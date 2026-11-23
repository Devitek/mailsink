import type { OverrideConfig, OverrideState, OverrideView } from '@mailsink/contracts'

// Pure helpers on `OverrideState` (#42): the optimistic updates of the panel and the pill.
// A scope is null for the workspace-wide override, else a connection id.

export type Scope = string | null

export function activeScopes(state: OverrideState): Scope[] {
  return [...(state.workspace ? [null] : []), ...state.connections.map((c) => c.connectionId)]
}

export function viewOf(state: OverrideState, scope: Scope): OverrideView | undefined {
  if (scope === null) return state.workspace ?? undefined
  return state.connections.find((c) => c.connectionId === scope)
}

export function withView(state: OverrideState, view: OverrideView): OverrideState {
  if (view.connectionId === null) return { ...state, workspace: view }
  const others = state.connections.filter((c) => c.connectionId !== view.connectionId)
  return { ...state, connections: [...others, view] }
}

export function withoutScopes(state: OverrideState, scopes: readonly Scope[]): OverrideState {
  return {
    ...state,
    workspace: scopes.includes(null) ? null : state.workspace,
    connections: state.connections.filter((c) => !scopes.includes(c.connectionId)),
  }
}

type Activation = { connectionId?: string; config: unknown; ttl?: unknown }

/** What the server will answer for an activation, shown until it does. */
export function pendingView(request: Activation, now: Date = new Date()): OverrideView {
  const ttl = typeof request.ttl === 'number' ? request.ttl : undefined
  return {
    id: 'ovr_pending' as OverrideView['id'],
    connectionId: (request.connectionId ?? null) as OverrideView['connectionId'],
    config: request.config as OverrideConfig,
    activatedVia: 'ui',
    expiresAt: ttl ? new Date(now.getTime() + ttl * 1000).toISOString() : null,
    createdAt: now.toISOString(),
  }
}
