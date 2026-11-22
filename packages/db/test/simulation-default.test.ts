import { SimulationSettings } from '@mailsink/contracts'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, expect, it } from 'vitest'
import { migrate } from '../src/migrate'
import { DEFAULT_SIMULATION_SETTINGS, workspaces } from '../src/schema'
import { createTestWorkspace, describeDb } from '../src/testing'
import { migrationsUpTo } from './journal'

it('stores the defaults of the SimulationSettings contract', () => {
  expect(DEFAULT_SIMULATION_SETTINGS).toEqual(SimulationSettings.parse({}))
})

describeDb(
  'workspaces.simulation',
  (ctx) => {
    let legacy: Awaited<ReturnType<typeof migrationsUpTo>>
    const ids = { untouched: '', custom: '' }

    beforeAll(async () => {
      // Database as 0000 left it: its column default stored `rates` only.
      legacy = await migrationsUpTo('0000_init')
      await migrate(ctx.handle, { migrationsFolder: legacy.folder })
      ids.untouched = (await createTestWorkspace(ctx.db)).id
      const partial = { rates: { hard_bounce: 10 }, openRate: 5 } as SimulationSettings
      ids.custom = (await createTestWorkspace(ctx.db, { simulation: partial })).id
      await migrate(ctx.handle)
    }, 60_000)
    afterAll(() => legacy?.dispose())

    const simulationOf = async (id: string) => {
      const [row] = await ctx.db.select().from(workspaces).where(eq(workspaces.id, id))
      return row?.simulation
    }

    it('fills partial rows left by 0000 with the contract defaults', async () => {
      expect(await simulationOf(ids.untouched)).toEqual(DEFAULT_SIMULATION_SETTINGS)
    })

    it('keeps stored keys when filling a partial row', async () => {
      expect(await simulationOf(ids.custom)).toEqual({
        ...DEFAULT_SIMULATION_SETTINGS,
        rates: { hard_bounce: 10 },
        openRate: 5,
      })
    })

    it('stores complete settings for a new workspace', async () => {
      const ws = await createTestWorkspace(ctx.db)
      expect(ws.simulation).toEqual(DEFAULT_SIMULATION_SETTINGS)
      expect(SimulationSettings.parse(ws.simulation)).toEqual(ws.simulation)
    })
  },
  { migrate: false },
)
