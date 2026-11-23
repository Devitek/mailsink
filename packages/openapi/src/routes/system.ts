import { z } from 'zod'
import type { RouteSpec } from '../route'

/** Body of `GET /healthz` (D42), mirrored from `apps/mailsink/src/http/health.ts`. */
export const Health = z.object({
  status: z.enum(['ok', 'unavailable']),
  uptimeSeconds: z.number().int(),
  checks: z.object({ database: z.enum(['ok', 'error']) }),
})

/** Public routes, no credential. */
export const SYSTEM_ROUTES: RouteSpec[] = [
  {
    tag: 'System',
    auth: 'none',
    operationId: 'healthz',
    method: 'get',
    path: '/healthz',
    summary: 'Liveness and readiness (database answers within 2 s)',
    success: [
      { status: 200, description: 'Ready.', schema: Health },
      { status: 503, description: 'The database does not answer.', schema: Health },
    ],
  },
  {
    tag: 'System',
    auth: 'none',
    operationId: 'getOpenApi',
    method: 'get',
    path: '/openapi.json',
    summary: 'This OpenAPI document',
    description: 'Public: it describes the routes and holds no data (D231).',
    success: [{ status: 200, description: 'The OpenAPI 3.1 document.', schema: z.looseObject({}) }],
  },
]
