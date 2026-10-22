import { Methods } from '@safe-global/safe-apps-sdk'
import * as web3 from '@/hooks/wallets/web3'
import { renderHook } from '@/tests/test-utils'
import { chainBuilder } from '@/tests/builders/chains'
import { getEmptySafeApp } from '@/components/safe-apps/utils'
import { FEATURES } from '@safe-global/utils/utils/chains'
import useAppCommunicator, { type UseAppCommunicatorHandlers } from './useAppCommunicator'

const mockOn = jest.fn()

jest.mock('@/services/safe-apps/AppCommunicator', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    on: mockOn,
    send: jest.fn(),
    clear: jest.fn(),
  })),
}))

type MessageHandler = (msg: { data: unknown }) => void

// EIP-1191 checksum of this address is rejected by ethers' strict EIP-55 check
const rskAddress = '0x52908400098527886E0F7030069857D2E4169ee7'
const eip55Address = '0x52908400098527886E0F7030069857D2E4169EE7'

const createHandlers = (): UseAppCommunicatorHandlers => ({
  onConfirmTransactions: jest.fn(),
  onSignMessage: jest.fn(),
  onGetTxBySafeTxHash: jest.fn(),
  onGetEnvironmentInfo: jest.fn(),
  onGetSafeBalances: jest.fn(),
  onGetSafeInfo: jest.fn(),
  onGetChainInfo: jest.fn(),
  onGetPermissions: jest.fn(),
  onSetPermissions: jest.fn(),
  onRequestAddressBook: jest.fn(),
  onSetSafeSettings: jest.fn(),
  onGetOffChainSignature: jest.fn(),
})

const getSendTransactionsHandler = (): MessageHandler | undefined =>
  mockOn.mock.calls.find(([method]) => method === Methods.sendTransactions)?.[1]

const sendTransactionsMessage = (to: string) => ({
  data: {
    id: 'request-id',
    params: { txs: [{ to, value: '0', data: '0x' }], params: { safeTxGas: 0 } },
    env: { sdkVersion: '1.0.0' },
  },
})

const renderCommunicator = (chainId: string, handlers: UseAppCommunicatorHandlers, features: Array<string> = []) => {
  const app = getEmptySafeApp('https://safe-app.example')
  const chain = chainBuilder().with({ chainId, features }).build()
  const iframeRef = { current: null }

  renderHook(() => useAppCommunicator(iframeRef, app, chain, handlers))
}

describe('useAppCommunicator', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(web3, 'createSafeAppsWeb3Provider').mockReturnValue(undefined)
  })

  describe('sendTransactions target addresses', () => {
    it('should accept EIP-1191 target addresses on RSK chains with the Rootstock support flag', () => {
      const handlers = createHandlers()
      renderCommunicator('30', handlers, [FEATURES.ROOTSTOCK_SUPPORT])

      getSendTransactionsHandler()?.(sendTransactionsMessage(rskAddress))

      expect(handlers.onConfirmTransactions).toHaveBeenCalledWith(
        [{ to: eip55Address, value: '0', data: '0x' }],
        'request-id',
        { safeTxGas: 0 },
      )
    })

    it('should reject EIP-1191 target addresses on RSK chains without the Rootstock support flag', () => {
      const handlers = createHandlers()
      renderCommunicator('30', handlers)

      expect(() => getSendTransactionsHandler()?.(sendTransactionsMessage(rskAddress))).toThrow()
      expect(handlers.onConfirmTransactions).not.toHaveBeenCalled()
    })

    it('should reject EIP-1191 target addresses on non-RSK chains', () => {
      const handlers = createHandlers()
      renderCommunicator('1', handlers)

      expect(() => getSendTransactionsHandler()?.(sendTransactionsMessage(rskAddress))).toThrow()
      expect(handlers.onConfirmTransactions).not.toHaveBeenCalled()
    })
  })
})
