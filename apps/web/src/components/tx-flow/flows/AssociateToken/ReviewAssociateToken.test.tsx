import { render } from '@/tests/test-utils'
import * as useChains from '@/hooks/useChains'
import { chainBuilder } from '@/tests/builders/chains'
import { FEATURES } from '@safe-global/utils/utils/chains'
import { initialContext, TxFlowContext } from '@/components/tx-flow/TxFlowProvider'
import ReviewAssociateToken from './ReviewAssociateToken'
import type { AssociateTokenParams } from '.'

jest.mock('@/hooks/useSafeInfo', () => ({
  __esModule: true,
  default: () => ({ safeAddress: '0x3DDDCE646712500aB55E1b2d6E61de4C409f50EF' }),
}))

jest.mock('@/services/tx/tx-sender', () => ({
  createTx: jest.fn().mockResolvedValue({}),
}))

// Isolate the token display this fix touches from the heavy tx-preview machinery.
jest.mock('@/components/tx/ReviewTransactionV2', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

const token = {
  tokenId: '0.0.731861',
  evmAddress: '0x00000000000000000000000000000000000b2ad5',
  name: 'SAUCE',
  symbol: 'SAUCE',
  decimals: 6,
  type: 'FUNGIBLE_COMMON' as const,
  deleted: false,
}

describe('ReviewAssociateToken', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('should link the token to its HashScan token page, not the account page', () => {
    jest.spyOn(useChains, 'useCurrentChain').mockReturnValue(
      chainBuilder()
        .with({ chainId: '295', isTestnet: false, features: [FEATURES.HEDERA] })
        .build(),
    )

    const { getByTestId } = render(
      <TxFlowContext.Provider value={{ ...initialContext, data: { token } as AssociateTokenParams }}>
        <ReviewAssociateToken onSubmit={jest.fn()} />
      </TxFlowContext.Provider>,
    )

    expect(getByTestId('explorer-btn')).toHaveAttribute(
      'href',
      'https://hashscan.io/mainnet/token/0x00000000000000000000000000000000000b2ad5',
    )
  })
})
