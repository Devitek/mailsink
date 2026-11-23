import { describe, expect, it } from 'vitest'
import { PickerSearch } from './search-params'

describe('PickerSearch', () => {
  it('hides ephemeral workspaces by default', () => {
    expect(PickerSearch.parse({})).toEqual({ ephemeral: false })
    expect(PickerSearch.parse({ ephemeral: true })).toEqual({ ephemeral: true })
    expect(PickerSearch.safeParse({ ephemeral: 'yes' }).success).toBe(false)
  })
})
