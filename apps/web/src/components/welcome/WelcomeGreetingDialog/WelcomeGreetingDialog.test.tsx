import { render, screen } from '@/tests/test-utils'
import userEvent from '@testing-library/user-event'
import WelcomeGreetingDialog from './index'

const mockUseChains = jest.fn()

jest.mock('@/hooks/useChains', () => ({
  __esModule: true,
  default: () => mockUseChains(),
}))

jest.mock('@/components/common/ChainIndicator', () => ({
  __esModule: true,
  default: ({ chainId }: { chainId: string }) => <span data-testid="chain-logo">{chainId}</span>,
}))

const stableEmptyConfigs: never[] = []

describe('WelcomeGreetingDialog', () => {
  const onClose = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    mockUseChains.mockReturnValue({ configs: stableEmptyConfigs, loading: false })
  })

  it('renders nothing when closed', () => {
    render(<WelcomeGreetingDialog open={false} onClose={onClose} />)

    expect(screen.queryByText('How to migrate your account')).not.toBeInTheDocument()
  })

  it('shows the logo and keeps the migration steps collapsed by default', () => {
    render(<WelcomeGreetingDialog open onClose={onClose} />)

    expect(screen.getByTestId('welcome-greeting-logo')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'How to migrate your account' })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
    expect(screen.queryByTestId('welcome-greeting-migration')).not.toBeInTheDocument()
  })

  it('hides the logo and shows the steps when the migration section is expanded', async () => {
    render(<WelcomeGreetingDialog open onClose={onClose} />)

    await userEvent.click(screen.getByRole('button', { name: 'How to migrate your account' }))

    expect(screen.getByTestId('welcome-greeting-migration')).toBeInTheDocument()
    expect(screen.queryByTestId('welcome-greeting-logo')).not.toBeInTheDocument()
    expect(screen.getAllByRole('listitem').length).toBeGreaterThan(3)
  })

  it('collapses the section again on a second click', async () => {
    render(<WelcomeGreetingDialog open onClose={onClose} />)
    const toggle = screen.getByRole('button', { name: 'How to migrate your account' })

    await userEvent.click(toggle)
    await userEvent.click(toggle)

    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByTestId('welcome-greeting-logo')).toBeInTheDocument()
  })

  it('calls onClose from the CTA and the close icon', async () => {
    render(<WelcomeGreetingDialog open onClose={onClose} />)

    await userEvent.click(screen.getByRole('button', { name: 'Go to Protofire Multisig' }))
    await userEvent.click(screen.getByRole('button', { name: 'close' }))

    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('renders 8 random network logos out of many available chains', () => {
    const configs = Array.from({ length: 30 }, (_, i) => ({
      chainId: String(i),
      isTestnet: false,
      chainLogoUri: `https://logo/${i}.png`,
    }))
    mockUseChains.mockReturnValue({ configs, loading: false })

    render(<WelcomeGreetingDialog open onClose={onClose} />)

    expect(screen.getAllByTestId('chain-logo')).toHaveLength(8)
  })

  it('renders no logos and does not loop when no chains are available', () => {
    mockUseChains.mockReturnValue({ configs: [], loading: false })

    render(<WelcomeGreetingDialog open onClose={onClose} />)

    expect(screen.queryAllByTestId('chain-logo')).toHaveLength(0)
    expect(screen.queryByTestId('welcome-greeting-chains')).not.toBeInTheDocument()
  })

  it('shows the logo row placeholder while chains are loading', () => {
    mockUseChains.mockReturnValue({ configs: [], loading: true })

    render(<WelcomeGreetingDialog open onClose={onClose} />)

    expect(screen.getByTestId('welcome-greeting-chains')).toBeInTheDocument()
  })

  it('derives the network count in the copy from the available chains', () => {
    const configs = Array.from({ length: 78 }, (_, i) => ({
      chainId: String(i),
      isTestnet: false,
      chainLogoUri: `https://logo/${i}.png`,
    }))
    mockUseChains.mockReturnValue({ configs, loading: false })

    render(<WelcomeGreetingDialog open onClose={onClose} />)

    expect(screen.getByText(/Manage your Safes across 70\+ supported networks/)).toBeInTheDocument()
  })

  it('falls back to generic copy when no chain count is available', () => {
    render(<WelcomeGreetingDialog open onClose={onClose} />)

    expect(screen.getByText(/Manage your Safes across all supported networks/)).toBeInTheDocument()
  })
})
