import { render } from '@/tests/test-utils'
import * as useChains from '@/hooks/useChains'
import * as hedera from '@/utils/hedera'
import { chainBuilder } from '@/tests/builders/chains'
import { FEATURES } from '@safe-global/utils/utils/chains'
import { TokenAssociation } from '.'

describe('TokenAssociation', () => {
  beforeEach(() => {
    // AssociatedTokensTable's own fetch is covered separately — keep it empty/inert here.
    jest.spyOn(hedera, 'getHederaAssociatedTokens').mockResolvedValue({ tokens: [], truncated: false })
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('should render the section on a Hedera chain', () => {
    jest.spyOn(useChains, 'useCurrentChain').mockReturnValue(
      chainBuilder()
        .with({ chainId: '295', features: [FEATURES.HEDERA] })
        .build(),
    )

    const { getByTestId, getByText } = render(<TokenAssociation />)

    expect(getByTestId('token-association-section')).toBeInTheDocument()
    expect(getByText('Token Association')).toBeInTheDocument()
    expect(getByText('Associate Token')).toBeInTheDocument()
  })

  it('should render nothing on a non-Hedera chain', () => {
    jest
      .spyOn(useChains, 'useCurrentChain')
      .mockReturnValue(chainBuilder().with({ chainId: '1', features: [] }).build())

    const { queryByTestId } = render(<TokenAssociation />)

    expect(queryByTestId('token-association-section')).not.toBeInTheDocument()
  })

  it('should render nothing when there is no current chain', () => {
    jest.spyOn(useChains, 'useCurrentChain').mockReturnValue(undefined)

    const { queryByTestId } = render(<TokenAssociation />)

    expect(queryByTestId('token-association-section')).not.toBeInTheDocument()
  })
})
