import { faker } from '@faker-js/faker'
import type { WalletKitTypes } from '@reown/walletkit'
import { render } from '@/tests/test-utils'
import * as useChains from '@/hooks/useChains'
import * as useSafeInfo from '@/hooks/useSafeInfo'
import { chainBuilder } from '@/tests/builders/chains'
import { extendedSafeInfoBuilder } from '@/tests/builders/safe'
import { CompatibilityWarning } from '../CompatibilityWarning'
import * as compatibility from '../useCompatibilityWarning'

describe('CompatibilityWarning', () => {
  const chains = Array.from({ length: 6 }, () =>
    chainBuilder()
      .with({ chainId: faker.string.numeric(8) })
      .build(),
  )
  const proposal = {} as WalletKitTypes.SessionProposal

  beforeEach(() => {
    jest.spyOn(useChains, 'default').mockReturnValue({ configs: chains } as ReturnType<typeof useChains.default>)
    jest.spyOn(useChains, 'useChain').mockImplementation((id) => chains.find((c) => c.chainId === id))
    jest.spyOn(compatibility, 'useCompatibilityWarning').mockReturnValue({ severity: 'warning', message: 'msg' })
  })

  const mockSafeChain = (chainId: string) =>
    jest.spyOn(useSafeInfo, 'default').mockReturnValue({
      safe: { ...extendedSafeInfoBuilder().build(), chainId },
    } as ReturnType<typeof useSafeInfo.default>)

  it('lists the supported networks with a count when the Safe chain is unsupported', () => {
    mockSafeChain('999999')

    const { getByText, getAllByTestId } = render(
      <CompatibilityWarning proposal={proposal} chainIds={chains.map((chain) => chain.chainId)} />,
    )

    expect(getByText('Supported networks (6)')).toBeInTheDocument()
    expect(getAllByTestId('chain-logo')).toHaveLength(6)
  })

  it('does not list networks when the Safe chain is supported', () => {
    mockSafeChain(chains[0].chainId)

    const { queryByText } = render(
      <CompatibilityWarning proposal={proposal} chainIds={chains.map((chain) => chain.chainId)} />,
    )

    expect(queryByText(/Supported networks/)).not.toBeInTheDocument()
  })
})
