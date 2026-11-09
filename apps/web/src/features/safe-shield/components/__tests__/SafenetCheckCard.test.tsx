import { render, screen, fireEvent, waitFor } from '@/tests/test-utils'
import type { TransactionDetails } from '@safe-global/store/gateway/AUTO_GENERATED/transactions'
import { CheckStatus, type PublicCheckStatus } from '@safe-global/utils/features/safenet-checks/types/status'
import { useSafenetCheck } from '@safe-global/utils/features/safenet-checks/hooks'
import { buildCheckView } from '@safe-global/utils/features/safenet-checks/builders'
import { selectCheckRequestedAtMs } from '@safe-global/store/safenet/safenetCheckSlice'
import { getStoreInstance } from '@/store'
import { TxFlowContext, initialContext } from '@/components/tx-flow/TxFlowProvider'
import { requestSafenetCheck } from '../../../safenet-checks/services/requestSafenetCheck'
import { SafenetCheckCard } from '../SafenetCheckCard'

jest.mock('@safe-global/utils/features/safenet-checks/constants', () => ({
  ...jest.requireActual('@safe-global/utils/features/safenet-checks/constants'),
  SAFENET_PROXY_URL: 'http://localhost:8787',
}))
jest.mock('../../../safenet-checks/services/requestSafenetCheck', () => ({ requestSafenetCheck: jest.fn() }))
jest.mock('@safe-global/utils/features/safenet-checks/hooks', () => ({ useSafenetCheck: jest.fn() }))
jest.mock('@/features/__core__', () => ({
  ...jest.requireActual('@/features/__core__'),
  useLoadFeature: () => ({
    $isReady: true,
    $isDisabled: false,
    SafenetCheckSection: ({ canRequestCheck }: { canRequestCheck?: boolean }) => (
      <div data-testid="safenet-check-section" data-can-request={String(canRequestCheck)} />
    ),
  }),
}))
jest.mock('@/hooks/useChains', () => ({ useCurrentChain: () => ({ chainId: '42161' }), useHasFeature: () => true }))
jest.mock('@/hooks/useSafeInfo', () => () => ({
  safe: { chainId: '42161', address: { value: '0x61af6845aA50eaC727422Bc458d9041C7b336E0A' } },
}))

const identity = {
  chainId: '42161',
  safeAddress: '0x61af6845aA50eaC727422Bc458d9041C7b336E0A',
  safeTxHash: '0x' + '1'.repeat(64),
}

const queuedDetails = {
  detailedExecutionInfo: { type: 'MULTISIG', safeTxHash: identity.safeTxHash, submittedAt: 1_700_000_000_000 },
} as unknown as TransactionDetails

const renderInFlow = (txId: string | undefined, txDetails?: TransactionDetails) =>
  render(
    <TxFlowContext.Provider value={{ ...initialContext, txId, txDetails }}>
      <SafenetCheckCard />
    </TxFlowContext.Provider>,
  )

const status = () => screen.getByTestId('safenet-check-status')

describe('SafenetCheckCard', () => {
  beforeEach(() => {
    jest.mocked(useSafenetCheck).mockReturnValue(buildCheckView({ unavailableReason: 'NO_CHECK' }))
    jest.mocked(requestSafenetCheck).mockReset()
    window.localStorage.clear()
  })

  it('tells a new transaction it can be checked once queued', () => {
    renderInFlow(undefined)
    expect(status()).toHaveTextContent('Available once signed and queued')
    expect(screen.queryByTestId('safenet-check-run-btn')).not.toBeInTheDocument()
  })

  it('renders nothing while a queued transaction has no details yet', () => {
    const { container } = renderInFlow('multisig_0x1_0x2')
    expect(container).toBeEmptyDOMElement()
  })

  it('offers to check an unchecked queued transaction and records the accepted request', async () => {
    jest.mocked(requestSafenetCheck).mockResolvedValue(undefined)
    renderInFlow('multisig_0x1_0x2', queuedDetails)
    expect(status()).toHaveTextContent('Not checked')

    fireEvent.click(screen.getByTestId('safenet-check-run-btn'))
    await waitFor(() => expect(requestSafenetCheck).toHaveBeenCalledWith(identity))
    await waitFor(() => expect(selectCheckRequestedAtMs(getStoreInstance().getState(), identity)).toBeDefined())
  })

  it('shows the landed verdict even while the request grace window is still open', () => {
    jest
      .mocked(useSafenetCheck)
      .mockReturnValue(
        buildCheckView({ status: CheckStatus.BENIGN, publicStatus: CheckStatus.BENIGN, isRequested: true }),
      )
    renderInFlow('multisig_0x1_0x2', queuedDetails)
    expect(status()).toHaveTextContent('Verified')
  })

  it('expands into the shared status block once a check exists, without a second request button', () => {
    jest
      .mocked(useSafenetCheck)
      .mockReturnValue(buildCheckView({ status: CheckStatus.BENIGN, publicStatus: CheckStatus.BENIGN }))
    renderInFlow('multisig_0x1_0x2', queuedDetails)
    expect(screen.queryByTestId('safenet-check-section')).not.toBeInTheDocument()

    fireEvent.click(status())
    expect(screen.getByTestId('safenet-check-section')).toHaveAttribute('data-can-request', 'false')
  })

  it('has nothing to expand for an unchecked transaction', () => {
    renderInFlow('multisig_0x1_0x2', queuedDetails)
    fireEvent.click(status())
    expect(screen.queryByTestId('safenet-check-section')).not.toBeInTheDocument()
  })

  it('shows the requested state without the button', () => {
    jest.mocked(useSafenetCheck).mockReturnValue(buildCheckView({ unavailableReason: 'NO_CHECK', isRequested: true }))
    renderInFlow('multisig_0x1_0x2', queuedDetails)
    expect(status()).toHaveTextContent('Requested')
    expect(screen.queryByTestId('safenet-check-run-btn')).not.toBeInTheDocument()
  })

  it.each<[PublicCheckStatus, string]>([
    [CheckStatus.BENIGN, 'Verified'],
    [CheckStatus.MALICIOUS, 'Denied'],
    [CheckStatus.IN_PROGRESS, 'In progress'],
  ])('shows %s as "%s" without the button', (verdict, label) => {
    jest.mocked(useSafenetCheck).mockReturnValue(buildCheckView({ status: verdict, publicStatus: verdict }))
    renderInFlow('multisig_0x1_0x2', queuedDetails)
    expect(status()).toHaveTextContent(label)
    expect(screen.queryByTestId('safenet-check-run-btn')).not.toBeInTheDocument()
  })

  it('reports a failed read without offering a request', () => {
    jest.mocked(useSafenetCheck).mockReturnValue(buildCheckView({ unavailableReason: 'READ_FAILED' }))
    renderInFlow('multisig_0x1_0x2', queuedDetails)
    expect(status()).toHaveTextContent('Unavailable')
    expect(screen.queryByTestId('safenet-check-run-btn')).not.toBeInTheDocument()
  })
})
