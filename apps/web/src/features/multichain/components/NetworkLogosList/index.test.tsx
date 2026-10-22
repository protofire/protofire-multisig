import { faker } from '@faker-js/faker'
import { render } from '@/tests/test-utils'
import * as useChains from '@/hooks/useChains'
import { chainBuilder } from '@/tests/builders/chains'
import NetworkLogosList from './index'
import css from './styles.module.css'

const createChains = (count: number) =>
  Array.from({ length: count }, () =>
    chainBuilder()
      .with({ chainId: faker.string.numeric(8) })
      .build(),
  )

describe('NetworkLogosList', () => {
  const chains = createChains(12)

  beforeEach(() => {
    jest.spyOn(useChains, 'default').mockReturnValue({ configs: chains } as ReturnType<typeof useChains.default>)
    jest.spyOn(useChains, 'useChain').mockImplementation((id) => chains.find((c) => c.chainId === id))
  })

  it('renders every network in a scrollable container without the overlap class', () => {
    const { getAllByTestId, getByTestId } = render(<NetworkLogosList networks={chains} />)

    expect(getAllByTestId('chain-logo')).toHaveLength(chains.length)
    expect(getByTestId('network-logos').className).not.toContain(css.stacked)
    expect(getByTestId('network-logos').style.getPropertyValue('--scrollable-chain-list-max-height')).toBe('80px')
  })

  it('applies a custom max height', () => {
    const { getByTestId } = render(<NetworkLogosList networks={chains} maxHeight={76} />)

    expect(getByTestId('network-logos').style.getPropertyValue('--scrollable-chain-list-max-height')).toBe('76px')
  })

  it('renders 4 logos plus a "+N" indicator with showHasMore', () => {
    const { getAllByTestId, getByText, queryByTestId } = render(<NetworkLogosList networks={chains} showHasMore />)

    expect(getAllByTestId('chain-logo')).toHaveLength(4)
    expect(getByText('+8')).toBeInTheDocument()
    expect(queryByTestId('network-logos')).not.toBeInTheDocument()
  })

  it('does not render "+N" when the networks fit with showHasMore', () => {
    const { queryByText } = render(<NetworkLogosList networks={chains.slice(0, 4)} showHasMore />)

    expect(queryByText(/^\+\d+$/)).not.toBeInTheDocument()
  })
})
