import { faker } from '@faker-js/faker'
import { render } from '@/tests/test-utils'
import * as useChains from '@/hooks/useChains'
import * as useWallet from '@/hooks/wallets/useWallet'
import { chainBuilder } from '@/tests/builders/chains'
import { connectedWalletBuilder } from '@/tests/builders/wallet'
import OverviewWidget from './index'

describe('OverviewWidget', () => {
  const chains = Array.from({ length: 5 }, () =>
    chainBuilder()
      .with({ chainId: faker.string.numeric(8) })
      .build(),
  )

  beforeEach(() => {
    jest.spyOn(useChains, 'default').mockReturnValue({ configs: chains } as ReturnType<typeof useChains.default>)
    jest.spyOn(useChains, 'useChain').mockImplementation((id) => chains.find((c) => c.chainId === id))
    jest.spyOn(useWallet, 'default').mockReturnValue(connectedWalletBuilder().build())
  })

  it('shows the network count in the row label', () => {
    const { getByText } = render(<OverviewWidget safeName="" networks={chains} />)

    expect(getByText('Network(s) (5)')).toBeInTheDocument()
  })
})
