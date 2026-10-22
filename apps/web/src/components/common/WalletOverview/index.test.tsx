import { render } from '@/tests/test-utils'
import { HederaNetwork } from '@/utils/hedera'
import { type EIP1193Provider } from '@web3-onboard/core'
import WalletOverview from '@/components/common/WalletOverview'
import * as useChains from '@/hooks/useChains'
import * as useHederaAccountIdHook from '@/hooks/useHederaAccountId'
import { chainBuilder } from '@/tests/builders/chains'

const mockWallet = {
  address: '0xd89cfd973d251ff04d345a4962afb5efa6382036',
  chainId: '296',
  label: 'HashPack',
  provider: null as unknown as EIP1193Provider,
}

describe('WalletOverview', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('should show the native Hedera account id instead of a "hedera:0x..." prefixed address', () => {
    jest
      .spyOn(useChains, 'useChain')
      .mockReturnValue(chainBuilder().with({ chainId: '296', shortName: 'hedera' }).build())
    jest
      .spyOn(useHederaAccountIdHook, 'default')
      .mockReturnValue({ accountId: '0.0.10822511', network: HederaNetwork.TESTNET, isHedera: true })

    const { getByText, queryByText } = render(<WalletOverview wallet={mockWallet} />)

    expect(getByText('0.0.10822511')).toBeInTheDocument()
    expect(queryByText(/hedera:/)).not.toBeInTheDocument()
  })

  it('should fall back to the prefixed hex address while the native account id is still resolving', () => {
    jest
      .spyOn(useChains, 'useChain')
      .mockReturnValue(chainBuilder().with({ chainId: '296', shortName: 'hedera' }).build())
    jest.spyOn(useHederaAccountIdHook, 'default').mockReturnValue({ accountId: undefined, isHedera: true })

    const { getByText } = render(<WalletOverview wallet={mockWallet} />)

    expect(getByText('0xd89c...2036')).toBeInTheDocument()
  })

  it('should show the plain address for non-Hedera chains', () => {
    jest.spyOn(useChains, 'useChain').mockReturnValue(chainBuilder().with({ chainId: '1', shortName: 'eth' }).build())
    jest.spyOn(useHederaAccountIdHook, 'default').mockReturnValue({ accountId: undefined, isHedera: false })

    const { getByText } = render(<WalletOverview wallet={{ ...mockWallet, chainId: '1' }} />)

    expect(getByText('0xd89c...2036')).toBeInTheDocument()
  })
})
