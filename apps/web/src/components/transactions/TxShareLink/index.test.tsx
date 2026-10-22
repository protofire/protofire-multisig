import { render } from '@/tests/test-utils'
import * as useChains from '@/hooks/useChains'
import { chainBuilder } from '@/tests/builders/chains'
import { FEATURES } from '@safe-global/utils/utils/chains'
import { TxExplorerLink } from '.'

const TX_HASH = '0xa62020b2a4c9f94306c6d30ff8e177c21c2840740a48efa89961f11511428014'
const HEDERA_TRANSACTION_ID = '0.0.10822511-1787674970-069053976'

describe('TxExplorerLink', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  const mockChain = (chainId: string, features: FEATURES[], explorer: string) => {
    jest.spyOn(useChains, 'useCurrentChain').mockReturnValue(
      chainBuilder()
        .with({
          chainId,
          features,
          isTestnet: false,
          blockExplorerUriTemplate: {
            address: `${explorer}/address/{{address}}`,
            txHash: `${explorer}/tx/{{txHash}}`,
            api: `${explorer}/api`,
          },
        })
        .build(),
    )
  }

  it('should link to the block explorer by tx hash on an EVM chain', () => {
    mockChain('1', [], 'https://etherscan.io')

    const { getByTestId } = render(<TxExplorerLink txHash={TX_HASH} />)

    expect(getByTestId('explorer-btn')).toHaveAttribute('href', `https://etherscan.io/tx/${TX_HASH}`)
  })

  it('should link to the block explorer by tx hash for an EVM transaction on Hedera', () => {
    mockChain('295', [FEATURES.HEDERA], 'https://hashscan.io/mainnet')

    const { getByTestId } = render(<TxExplorerLink txHash={TX_HASH} />)

    expect(getByTestId('explorer-btn')).toHaveAttribute('href', `https://hashscan.io/mainnet/tx/${TX_HASH}`)
  })

  it('should link to HashScan by Hedera transaction id for a native Hedera transfer', () => {
    mockChain('295', [FEATURES.HEDERA], 'https://hashscan.io/mainnet')

    const { getByTestId } = render(<TxExplorerLink txHash={TX_HASH} hederaTransactionId={HEDERA_TRANSACTION_ID} />)

    expect(getByTestId('explorer-btn')).toHaveAttribute(
      'href',
      `https://hashscan.io/mainnet/transaction/${HEDERA_TRANSACTION_ID}`,
    )
  })
})
