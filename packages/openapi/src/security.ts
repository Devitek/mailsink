import type { ZodOpenApiComponentsObject } from 'zod-openapi'
import type { RouteAuth } from './route'

type SecurityRequirement = Record<string, string[]>

/** Credentials of D41: `Authorization: Bearer`, else the Brevo `api-key` header. */
export const SECURITY_SCHEMES: NonNullable<ZodOpenApiComponentsObject['securitySchemes']> = {
  adminKey: {
    type: 'http',
    scheme: 'bearer',
    description:
      'Admin key of the instance (`MAILSINK_ADMIN_KEY`). Without it the Admin API answers 401 (D43).',
  },
  connectionKey: {
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'msk_',
    description:
      'Connection key (`msk_…`). Ingestion routes require one of the right kind: any kind on `/v1`, a `resend` connection on `/emails`, a `brevo` connection on `/v3`.',
  },
  workspaceKey: {
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'mskw_',
    description: 'Workspace key (`mskw_…`): Capture API and MCP of one workspace (D12).',
  },
  brevoApiKey: {
    type: 'apiKey',
    in: 'header',
    name: 'api-key',
    description: 'Brevo style credential: a `brevo` connection key (`msk_…`) in `api-key`.',
  },
  workspaceHeader: {
    type: 'apiKey',
    in: 'header',
    name: 'X-Mailsink-Workspace',
    description:
      'Workspace id or slug, required with the Admin key on workspace scoped routes (400 when missing).',
  },
}

/** Alternatives (OR) of each auth mode; keys inside one requirement are combined (AND). */
const REQUIREMENTS: Record<RouteAuth, SecurityRequirement[]> = {
  none: [],
  admin: [{ adminKey: [] }],
  // Workspace scope (D12): a connection or workspace key, or the Admin key + the header.
  workspace: [{ connectionKey: [] }, { workspaceKey: [] }, { adminKey: [], workspaceHeader: [] }],
  connection: [{ connectionKey: [] }],
  brevo: [{ brevoApiKey: [] }, { connectionKey: [] }],
}

export function securityOf(auth: RouteAuth): SecurityRequirement[] {
  return REQUIREMENTS[auth]
}
