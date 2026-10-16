import { render, waitFor } from '@/tests/test-utils'
import { ZERO_ADDRESS } from '@safe-global/protocol-kit/dist/src/utils/constants'
import type { SafeTransaction } from '@safe-global/types-kit'
import ReviewTokenTransfer from '@/components/tx-flow/flows/TokenTransfer/ReviewTokenTransfer'
import { SafeTxContext } from '@/components/tx-flow/SafeTxProvider'
import * as useBalances from '@/hooks/useBalances'
import * as txSender from '@/services/tx/tx-sender'

jest.mock('@/components/tx/ReviewTransactionV2', () => ({
  __esModule: true,
  default: ({ children }: { children?: React.ReactNode }) => <div data-testid="review-transaction">{children}</div>,
}))

describe('ReviewTokenTransfer', () => {
  const setSafeTx = jest.fn()
  const setSafeTxError = jest.fn()
  const setNonce = jest.fn()

  const mockParams = {
    recipients: [
      {
        recipient: '0x1234567890123456789012345678901234567890',
        tokenAddress: ZERO_ADDRESS,
        amount: '1',
      },
    ],
  }

  const renderComponent = () =>
    render(
      <SafeTxContext.Provider
        value={{
          setSafeTx,
          setSafeTxError,
          setNonce,
          setSafeMessage: jest.fn(),
          setNonceNeeded: jest.fn(),
          setSafeTxGas: jest.fn(),
          setTxOrigin: jest.fn(),
          isReadOnly: false,
        }}
      >
        <ReviewTokenTransfer params={mockParams} onSubmit={jest.fn()} />
      </SafeTxContext.Provider>,
    )

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('does not attempt to build a transaction while balances have not loaded yet', () => {
    jest.spyOn(useBalances, 'default').mockReturnValue({
      balances: { items: [], fiatTotal: '' },
      loaded: false,
      loading: true,
      error: undefined,
    })
    const createTxSpy = jest.spyOn(txSender, 'createMultiSendCallOnlyTx')

    renderComponent()

    // Building from an empty/not-yet-loaded balances list would otherwise throw
    // "Invalid empty array of transactions" and surface a false-positive error
    expect(createTxSpy).not.toHaveBeenCalled()
    expect(setSafeTxError).not.toHaveBeenCalled()
  })

  it('builds the native transfer once balances have loaded and clears a stale error', async () => {
    jest.spyOn(useBalances, 'default').mockReturnValue({
      balances: {
        items: [
          {
            balance: '1000000000000000000',
            fiatBalance: '1',
            fiatConversion: '1',
            tokenInfo: {
              type: 'NATIVE_TOKEN',
              address: ZERO_ADDRESS,
              decimals: 18,
              symbol: 'ETH',
              name: 'Ether',
              logoUri: '',
            },
          },
        ],
        fiatTotal: '1',
      },
      loaded: true,
      loading: false,
      error: undefined,
    })

    const mockTx = { data: {} } as SafeTransaction
    jest.spyOn(txSender, 'createMultiSendCallOnlyTx').mockResolvedValue(mockTx)

    renderComponent()

    await waitFor(() => expect(setSafeTx).toHaveBeenCalledWith(mockTx))
    // A previously-set error (e.g. from an earlier render while balances were loading)
    // must be cleared once a valid tx is built, so a stale warning doesn't stick around
    expect(setSafeTxError).toHaveBeenCalledWith(undefined)
  })
})
