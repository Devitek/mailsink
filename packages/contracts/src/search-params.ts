import { z } from 'zod'

// Search params of the UI routes (TanStack Router `validateSearch`), validated with Zod.
// The router parses query values as JSON, so `?ephemeral=true` arrives as a boolean.

/** `/`: the workspace picker; ephemeral workspaces are hidden by default (#37). */
export const PickerSearch = z.object({ ephemeral: z.boolean().default(false) })
export type PickerSearch = z.infer<typeof PickerSearch>
