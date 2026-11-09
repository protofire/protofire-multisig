import { render, screen, fireEvent, waitFor } from '@/tests/test-utils'
import { CheckStatus } from '@safe-global/utils/features/safenet-checks/types/status'
import { useSafenetCheck } from '@safe-global/utils/features/safenet-checks/hooks'
import { buildCheckView } from '@safe-global/utils/features/safenet-checks/builders'
import { selectCheckRequestedAtMs } from '@safe-global/store/safenet/safenetCheckSlice'
import { getStoreInstance } from '@/store'
import { requestSafenetCheck } from '../../../services/requestSafenetCheck'
import SafenetCheckSection from '../index'

jest.mock('@safe-global/utils/features/safenet-checks/constants', () => ({
  ...jest.requireActual('@safe-global/utils/features/safenet-checks/constants'),
  SAFENET_PROXY_URL: 'http://localhost:8787',
}))
jest.mock('../../../services/requestSafenetCheck', () => ({ requestSafenetCheck: jest.fn() }))
jest.mock('@safe-global/utils/features/safenet-checks/hooks', () => ({ useSafenetCheck: jest.fn() }))

const identity = {
  chainId: '42161',
  safeAddress: '0x61af6845aA50eaC727422Bc458d9041C7b336E0A',
  safeTxHash: '0x' + '1'.repeat(64),
}

const noCheckView = buildCheckView({ unavailableReason: 'NO_CHECK' })
const requestedView = buildCheckView({ unavailableReason: 'NO_CHECK', isRequested: true })

describe('SafenetCheckSection', () => {
  beforeEach(() => {
    jest.mocked(useSafenetCheck).mockReturnValue(noCheckView)
    jest.mocked(requestSafenetCheck).mockReset()
    window.localStorage.clear()
  })

  it('offers to request a check when none was recorded', () => {
    render(<SafenetCheckSection {...identity} />)
    expect(screen.getByTestId('safenet-request-check')).toBeInTheDocument()
  })

  it('renders nothing for an unchecked transaction that can no longer be influenced', () => {
    const { container } = render(<SafenetCheckSection {...identity} canRequestCheck={false} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('keeps showing a recorded request where requesting is not offered', () => {
    jest.mocked(useSafenetCheck).mockReturnValue(requestedView)
    render(<SafenetCheckSection {...identity} canRequestCheck={false} />)
    expect(screen.getByText('Check requested')).toBeInTheDocument()
    expect(screen.queryByTestId('safenet-request-check')).not.toBeInTheDocument()
  })

  it('still reports a failed read for a transaction that can no longer be influenced', () => {
    jest.mocked(useSafenetCheck).mockReturnValue(buildCheckView({ unavailableReason: 'READ_FAILED' }))
    render(<SafenetCheckSection {...identity} canRequestCheck={false} />)
    expect(screen.getByText('Could not read status')).toBeInTheDocument()
    expect(screen.queryByTestId('safenet-request-check')).not.toBeInTheDocument()
  })

  it('shows the requested state instead of the button', () => {
    jest.mocked(useSafenetCheck).mockReturnValue(requestedView)
    render(<SafenetCheckSection {...identity} />)
    expect(screen.queryByTestId('safenet-request-check')).not.toBeInTheDocument()
    expect(screen.getByText('Check requested')).toBeInTheDocument()
  })

  it('passes the identity to the request service and records the accepted request', async () => {
    jest.mocked(requestSafenetCheck).mockResolvedValue(undefined)
    render(<SafenetCheckSection {...identity} />)
    fireEvent.click(screen.getByTestId('safenet-request-check'))
    await waitFor(() => expect(requestSafenetCheck).toHaveBeenCalledWith(identity))
    await waitFor(() => expect(selectCheckRequestedAtMs(getStoreInstance().getState(), identity)).toBeDefined())
  })

  it('links to the explorer only once a check exists', () => {
    const { rerender } = render(<SafenetCheckSection {...identity} />)
    expect(screen.queryByRole('link')).not.toBeInTheDocument()

    jest
      .mocked(useSafenetCheck)
      .mockReturnValue(buildCheckView({ status: CheckStatus.BENIGN, publicStatus: CheckStatus.BENIGN }))
    rerender(<SafenetCheckSection {...identity} />)
    expect(screen.getByRole('link', { name: 'View on Safenet Explorer' })).toHaveAttribute(
      'href',
      expect.stringContaining(identity.safeTxHash),
    )
  })

  it('shows the failure hint and records nothing when the request throws', async () => {
    jest.mocked(requestSafenetCheck).mockRejectedValue(new Error('500'))
    render(<SafenetCheckSection {...identity} />)
    fireEvent.click(screen.getByTestId('safenet-request-check'))
    expect(await screen.findByText(/The request failed/)).toBeInTheDocument()
    expect(selectCheckRequestedAtMs(getStoreInstance().getState(), identity)).toBeUndefined()
  })
})
