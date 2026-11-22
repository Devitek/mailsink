import { customType, timestamp } from 'drizzle-orm/pg-core'

/** `timestamptz` column, the only timestamp flavour used by the schema. */
export const tstz = (name: string) => timestamp(name, { withTimezone: true })

/** `timestamptz not null default now()`. */
export const createdAt = (name = 'created_at') => tstz(name).notNull().defaultNow()

/** Binary column (D8). Both drivers return a Uint8Array (node-postgres: a Buffer). */
export const bytea = customType<{ data: Uint8Array; driverData: Uint8Array }>({
  dataType: () => 'bytea',
})
