import { render, screen } from '@/tests/test-utils'
import useChainId from '@/hooks/useChainId'
import { useHasFeature } from '@/hooks/useChains'
import SunsetBanner from './index'

jest.mock('@/hooks/useChainId', () => ({ __esModule: true, default: jest.fn() }))
jest.mock('@/hooks/useChains', () => ({
  ...jest.requireActual('@/hooks/useChains'),
  useHasFeature: jest.fn(),
}))
jest.mock('./config', () => ({
  SUNSET_BANNERS: [
    {
      id: 'with-deadline',
      chainIds: ['1001', '1002'],
      title: 'Deadline banner title',
      description: 'Withdraw your funds until {date}.',
      deadline: '2030-01-15',
    },
    {
      id: 'with-link',
      chainIds: ['2001'],
      title: 'Link banner title',
      description: 'Moving to [the new instance](https://example.com/new-instance) soon.',
    },
  ],
}))

describe('SunsetBanner', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(useHasFeature as jest.Mock).mockReturnValue(true)
  })

  it.each(['1001', '1002'])('renders the banner configured for chain %s with the formatted deadline', (chainId) => {
    ;(useChainId as jest.Mock).mockReturnValue(chainId)

    render(<SunsetBanner />)

    expect(screen.getByText('Deadline banner title')).toBeInTheDocument()
    expect(screen.getByText(/Withdraw your funds until January 15, 2030\./)).toBeInTheDocument()
  })

  it('renders links inside the description', () => {
    ;(useChainId as jest.Mock).mockReturnValue('2001')

    render(<SunsetBanner />)

    expect(screen.getByText('Link banner title')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'the new instance' })).toHaveAttribute(
      'href',
      'https://example.com/new-instance',
    )
  })

  it('renders only the banner of the current chain', () => {
    ;(useChainId as jest.Mock).mockReturnValue('2001')

    render(<SunsetBanner />)

    expect(screen.queryByText('Deadline banner title')).not.toBeInTheDocument()
  })

  it('renders nothing for chains without a banner', () => {
    ;(useChainId as jest.Mock).mockReturnValue('1')

    const { container } = render(<SunsetBanner />)

    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing when the feature is disabled', () => {
    ;(useChainId as jest.Mock).mockReturnValue('1001')
    ;(useHasFeature as jest.Mock).mockReturnValue(false)

    const { container } = render(<SunsetBanner />)

    expect(container).toBeEmptyDOMElement()
  })
})
