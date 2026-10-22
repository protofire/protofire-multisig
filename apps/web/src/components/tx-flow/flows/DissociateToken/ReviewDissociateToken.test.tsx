import { render } from '@/tests/test-utils'
import * as useChains from '@/hooks/useChains'
import { chainBuilder } from '@/tests/builders/chains'
import { FEATURES } from '@safe-global/utils/utils/chains'
import { ReviewDissociateToken } from './ReviewDissociateToken'
import type { DissociateTokenFlowProps } from '.'

jest.mock('@/hooks/useSafeInfo', () => ({
  __esModule: true,
  default: () => ({ safeAddress: '0x3DDDCE646712500aB55E1b2d6E61de4C409f50EF' }),
}))

jest.mock('@/services/tx/tx-sender', () => ({
  createTx: jest.fn().mockResolvedValue({}),
}))

// Isolate the token display this component builds from the heavy tx-preview machinery.
jest.mock('@/components/tx/ReviewTransactionV2', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

const token = {
  tokenId: '0.0.731861',
  evmAddress: '0x00000000000000000000000000000000000b2ad5',
  balance: 0,
  decimals: 6,
  freezeStatus: 'NOT_APPLICABLE' as const,
  createdAt: new Date(),
}

describe('ReviewDissociateToken', () => {
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
      <ReviewDissociateToken params={{ token } as DissociateTokenFlowProps} onSubmit={jest.fn()} />,
    )

    expect(getByTestId('explorer-btn')).toHaveAttribute(
      'href',
      'https://hashscan.io/mainnet/token/0x00000000000000000000000000000000000b2ad5',
    )
  })

  it('should warn when the token still has a non-zero balance', () => {
    jest.spyOn(useChains, 'useCurrentChain').mockReturnValue(
      chainBuilder()
        .with({ chainId: '295', isTestnet: false, features: [FEATURES.HEDERA] })
        .build(),
    )

    const { getByText } = render(
      <ReviewDissociateToken
        params={{ token: { ...token, balance: 10 } } as DissociateTokenFlowProps}
        onSubmit={jest.fn()}
      />,
    )

    expect(getByText(/still has a non-zero balance/i)).toBeInTheDocument()
  })

  it('should not warn when the token balance is zero', () => {
    jest.spyOn(useChains, 'useCurrentChain').mockReturnValue(
      chainBuilder()
        .with({ chainId: '295', isTestnet: false, features: [FEATURES.HEDERA] })
        .build(),
    )

    const { queryByText } = render(
      <ReviewDissociateToken params={{ token } as DissociateTokenFlowProps} onSubmit={jest.fn()} />,
    )

    expect(queryByText(/still has a non-zero balance/i)).toBeNull()
  })
})
