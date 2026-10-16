import { render } from '@/tests/test-utils'
import { FEATURES } from '@safe-global/utils/utils/chains'
import NewNetworkChip from './NewNetworkChip'

describe('NewNetworkChip', () => {
  it('renders a "New" tag when the chain has the NEW_NETWORK feature', () => {
    const { getByText } = render(<NewNetworkChip chain={{ features: [FEATURES.NEW_NETWORK] }} />)

    expect(getByText('New')).toBeInTheDocument()
  })

  it('renders nothing when the chain does not have the NEW_NETWORK feature', () => {
    const { queryByText } = render(<NewNetworkChip chain={{ features: [FEATURES.SAFE_APPS] }} />)

    expect(queryByText('New')).not.toBeInTheDocument()
  })
})
