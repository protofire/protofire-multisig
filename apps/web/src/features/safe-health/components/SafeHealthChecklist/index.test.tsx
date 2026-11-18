import { render, screen } from '@/tests/test-utils'
import useSafeInfo from '@/hooks/useSafeInfo'
import { extendedSafeInfoBuilder } from '@/tests/builders/safe'
import { useSafeHealthChecks } from '../../hooks/useSafeHealthChecks'
import { getOwnersCheck } from '../../services/checks'
import SafeHealthChecklist from '.'

jest.mock('@/hooks/useSafeInfo')
jest.mock('../../hooks/useSafeHealthChecks')

const mockSafeInfo = (deployed: boolean, safeLoaded: boolean) =>
  (useSafeInfo as jest.MockedFunction<typeof useSafeInfo>).mockReturnValue({
    safe: extendedSafeInfoBuilder().with({ deployed }).build(),
    safeAddress: '',
    safeLoaded,
    safeLoading: false,
  })

describe('SafeHealthChecklist', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(useSafeHealthChecks as jest.MockedFunction<typeof useSafeHealthChecks>).mockReturnValue({
      checks: [getOwnersCheck(1, 1)],
      hideVersionOnHome: false,
    })
  })

  it('renders nothing while the Safe is not loaded', () => {
    mockSafeInfo(true, false)

    const { container } = render(<SafeHealthChecklist variant="home" />)

    expect(container).toBeEmptyDOMElement()
  })

  it.each(['home', 'settings'] as const)('shows the activation line for an undeployed Safe on %s', (variant) => {
    mockSafeInfo(false, true)

    render(<SafeHealthChecklist variant={variant} />)

    expect(screen.getByText('Checks start after activation.')).toBeInTheDocument()
    expect(screen.queryByText('1 out of 1 signer must confirm')).not.toBeInTheDocument()
  })

  it('shows the checks for a deployed Safe', () => {
    mockSafeInfo(true, true)

    render(<SafeHealthChecklist variant="settings" />)

    expect(screen.getByText('1 out of 1 signer must confirm')).toBeInTheDocument()
  })
})
