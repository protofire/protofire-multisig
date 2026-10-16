import { render, screen } from '@/tests/test-utils'
import { chainBuilder } from '@/tests/builders/chains'
import { safeInfoBuilder } from '@/tests/builders/safe'
import { initialState as initialSettings } from '@/store/settingsSlice'
import useSafeInfo from '@/hooks/useSafeInfo'
import { useCurrentChain } from '@/hooks/useChains'
import { utils as tronWebUtils } from 'tronweb'
import ErrorMessage from '.'

jest.mock('@/hooks/useSafeInfo')
jest.mock('@/hooks/useChains', () => ({ useCurrentChain: jest.fn() }))
jest.mock('@/hooks/useChainId', () => ({ __esModule: true, default: () => '728126428' }))

const address = '0x0b9ca12d2ce6a6ec17df8fc602144c55a6ab1717'

describe('Guard explorer links', () => {
  beforeEach(() => {
    jest.spyOn(tronWebUtils.address, 'fromHex').mockReturnValue('TB2c4z3BMsxhY6EsmkqcktUuonyVYXWFhC')
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })
  it.each(['hex', 'base58'] as const)('uses base58 regardless of the %s display setting', (tronAddressFormat) => {
    const chain = chainBuilder()
      .with({
        chainId: '728126428',
        blockExplorerUriTemplate: {
          address: 'https://tronscan.org/#/address/{{address}}',
          txHash: 'https://tronscan.org/#/transaction/{{txHash}}',
          api: '',
        },
      })
      .build()
    jest.mocked(useCurrentChain).mockReturnValue(chain)
    jest.mocked(useSafeInfo).mockReturnValue({
      safe: safeInfoBuilder()
        .with({ chainId: chain.chainId, guard: { value: address } })
        .build(),
    } as ReturnType<typeof useSafeInfo>)

    render(
      <ErrorMessage error={new Error('execution reverted: 0x70cc6907')} context="execution">
        Failed
      </ErrorMessage>,
      {
        routerProps: { query: { safe: `trx:${address}` } },
        initialReduxState: { settings: { ...initialSettings, tronAddressFormat } },
      },
    )

    expect(screen.getByRole('link', { name: 'Guard' })).toHaveAttribute(
      'href',
      'https://tronscan.org/#/address/TB2c4z3BMsxhY6EsmkqcktUuonyVYXWFhC',
    )
  })
})
