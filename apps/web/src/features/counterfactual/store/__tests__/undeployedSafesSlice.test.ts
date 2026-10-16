import type { UndeployedSafe } from '../../types'
import { PendingSafeStatus } from '../../types'
import { PayMethod } from '@safe-global/utils/features/counterfactual/types'
import { undeployedSafesSlice, upsertUndeployedSafe } from '../undeployedSafesSlice'

const safeA = {
  props: { safeAccountConfig: { owners: ['0xA'], threshold: 1 } },
  status: { status: PendingSafeStatus.AWAITING_EXECUTION, type: PayMethod.PayNow },
} as unknown as UndeployedSafe

const safeB = {
  props: { safeAccountConfig: { owners: ['0xB'], threshold: 1 } },
  status: { status: PendingSafeStatus.PROCESSING, type: PayMethod.PayLater },
} as unknown as UndeployedSafe

describe('undeployedSafesSlice', () => {
  describe('upsertUndeployedSafe', () => {
    it('should add an undeployed Safe without touching other chains/addresses already in the store', () => {
      const state = { '1': { '0x0': safeA } }

      const result = undeployedSafesSlice.reducer(
        state,
        upsertUndeployedSafe({ chainId: '4', address: '0x1', safe: safeB }),
      )

      expect(result).toEqual({
        '1': { '0x0': safeA },
        '4': { '0x1': safeB },
      })
    })

    it('should overwrite an existing entry entirely with the imported one', () => {
      const state = { '1': { '0x0': safeA } }

      const result = undeployedSafesSlice.reducer(
        state,
        upsertUndeployedSafe({ chainId: '1', address: '0x0', safe: safeB }),
      )

      expect(result).toEqual({
        '1': { '0x0': safeB },
      })
    })
  })
})
