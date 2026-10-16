import { renderHook, waitFor } from '@/tests/test-utils'
import usePendingSafeStatus from '../usePendingSafeStatuses'
import { SafeCreationEvent, safeCreationDispatch, safeCreationSubscribe } from '../../services/safeCreationEvents'
import { pollSafeInfo } from '@/components/new-safe/create/logic'
import { defaultSafeInfo } from '@safe-global/store/slices/SafeInfo/utils'
import { PayMethod } from '@safe-global/utils/features/counterfactual/types'
import { PendingSafeStatus } from '@safe-global/utils/features/counterfactual/store/types'
import { getStoreInstance } from '@/store'

jest.mock('../../services/safeCreationEvents', () => {
  const actual = jest.requireActual('../../services/safeCreationEvents')
  return {
    ...actual,
    safeCreationSubscribe: jest.fn(),
    safeCreationDispatch: jest.fn(),
  }
})

jest.mock('../../services/safeDeployment', () => ({
  checkSafeActivation: jest.fn(),
  checkSafeActionViaRelay: jest.fn(),
  extractCounterfactualSafeSetup: jest.fn(),
}))

jest.mock('@/components/new-safe/create/logic', () => ({
  pollSafeInfo: jest.fn(),
}))

jest.mock('@/hooks/useChainId', () => ({
  __esModule: true,
  default: jest.fn(),
}))

jest.mock('@/hooks/useChains', () => ({
  useCurrentChain: jest.fn(),
}))

jest.mock('@/hooks/useSafeInfo', () => ({
  __esModule: true,
  default: jest.fn(),
}))

jest.mock('@/hooks/wallets/web3ReadOnly', () => ({
  useWeb3ReadOnly: jest.fn(),
}))

jest.mock('@/services/analytics', () => ({
  trackEvent: jest.fn(),
  CREATE_SAFE_EVENTS: {},
  MixpanelEventParams: {},
}))

jest.mock('@/utils/wallets', () => ({
  isSmartContract: jest.fn(),
}))

const mockUseChainId = jest.requireMock('@/hooks/useChainId').default as jest.Mock
const mockUseCurrentChain = jest.requireMock('@/hooks/useChains').useCurrentChain as jest.Mock
const mockUseSafeInfo = jest.requireMock('@/hooks/useSafeInfo').default as jest.Mock
const mockUseWeb3ReadOnly = jest.requireMock('@/hooks/wallets/web3ReadOnly').useWeb3ReadOnly as jest.Mock
const mockIsSmartContract = jest.requireMock('@/utils/wallets').isSmartContract as jest.Mock

describe('usePendingSafeStatuses', () => {
  const chainId = '1'
  const safeAddress = '0x1111111111111111111111111111111111111111'

  const setupMocks = (chainId = '1', getBlockNumber = jest.fn().mockResolvedValue(123)) => {
    mockUseChainId.mockReturnValue(chainId)
    mockUseCurrentChain.mockReturnValue({ chainId, chainName: 'Ethereum' })
    mockUseSafeInfo.mockReturnValue({
      safe: { ...defaultSafeInfo, chainId, address: { value: safeAddress } },
      safeAddress,
      safeLoaded: true,
      safeLoading: false,
    })
    mockUseWeb3ReadOnly.mockReturnValue({
      getBlockNumber,
      getNetwork: jest.fn().mockResolvedValue({ chainId: BigInt(chainId) }),
    })
    mockIsSmartContract.mockResolvedValue(false)
  }

  beforeEach(() => {
    jest.resetAllMocks()
    ;(pollSafeInfo as jest.Mock).mockResolvedValue(undefined)
  })

  it('polls CGW and dispatches INDEXED on SUCCESS', async () => {
    setupMocks()

    const subscriptions: Record<string, (detail: unknown) => void> = {}
    ;(safeCreationSubscribe as jest.Mock).mockImplementation((event, callback) => {
      subscriptions[event] = callback
      return jest.fn()
    })

    renderHook(() => usePendingSafeStatus(), { initialReduxState: { undeployedSafes: {} } })

    subscriptions[SafeCreationEvent.SUCCESS]?.({
      groupKey: 'group',
      safeAddress,
      chainId,
      type: PayMethod.PayLater,
    })

    await waitFor(() => {
      expect(pollSafeInfo).toHaveBeenCalledWith(chainId, safeAddress)
      expect(safeCreationDispatch).toHaveBeenCalledWith(SafeCreationEvent.INDEXED, {
        groupKey: 'group',
        safeAddress,
        chainId,
      })
    })
  })

  describe('on PROCESSING', () => {
    const txHash = `0x${'ab'.repeat(32)}`

    const process = async (chainId: string, getBlockNumber: jest.Mock) => {
      setupMocks(chainId, getBlockNumber)
      const subscriptions: Record<string, (detail: unknown) => void> = {}
      ;(safeCreationSubscribe as jest.Mock).mockImplementation((event, callback) => {
        subscriptions[event] = callback
        return jest.fn()
      })
      const undeployedSafe = {
        props: { safeAccountConfig: { owners: [safeAddress], threshold: 1 }, safeDeploymentConfig: {} },
        status: { status: PendingSafeStatus.AWAITING_EXECUTION, type: PayMethod.PayNow },
      }
      renderHook(() => usePendingSafeStatus(), {
        initialReduxState: { undeployedSafes: { [chainId]: { [safeAddress]: undeployedSafe } } },
      })

      subscriptions[SafeCreationEvent.PROCESSING]?.({ groupKey: 'group', txHash, safeAddress })

      await waitFor(() => {
        expect(getStoreInstance().getState().undeployedSafes[chainId][safeAddress].status.status).toBe(
          PendingSafeStatus.PROCESSING,
        )
      })
      return getStoreInstance().getState().undeployedSafes[chainId][safeAddress].status
    }

    it('records the hash on Tron without asking the read endpoint for a block number', async () => {
      const getBlockNumber = jest.fn().mockRejectedValue(new Error('503'))

      await expect(process('728126428', getBlockNumber)).resolves.toMatchObject({ txHash, startBlock: undefined })
      expect(getBlockNumber).not.toHaveBeenCalled()
    })

    it('records the hash with the start block on other chains', async () => {
      await expect(process('1', jest.fn().mockResolvedValue(123))).resolves.toMatchObject({ txHash, startBlock: 123 })
    })
  })
})
