import { render, screen, fireEvent } from '@/tests/test-utils'
import { CheckStatus } from '@safe-global/utils/features/safenet-checks/types/status'
import SafenetCheckStatus from '../SafenetCheckStatus'
import { getStatusCopy } from '../../../statusCopy'

const baseProps = {
  unavailableReason: undefined,
  isLoading: false,
  isStale: false,
  explorerUrl: 'https://explorer.example/#/safeTx?chainId=1&safeTxHash=0x1',
  onRefresh: jest.fn(),
}

describe('SafenetCheckStatus', () => {
  it('renders a skeleton while the first read is unresolved', () => {
    render(<SafenetCheckStatus {...baseProps} status={CheckStatus.UNAVAILABLE} />)
    expect(screen.getByTestId('safenet-check-loading')).toBeInTheDocument()
    expect(screen.queryByTestId('safenet-check-status')).not.toBeInTheDocument()
  })

  it('renders the verified state with an explorer link', () => {
    render(<SafenetCheckStatus {...baseProps} status={CheckStatus.BENIGN} />)
    expect(screen.getByText('Verified by Safenet')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'View on Safenet Explorer' })).toHaveAttribute(
      'href',
      baseProps.explorerUrl,
    )
  })

  it('renders the malicious state as an error', () => {
    render(<SafenetCheckStatus {...baseProps} status={CheckStatus.MALICIOUS} />)
    expect(screen.getByText('Denied by Safenet')).toBeInTheDocument()
    expect(screen.getByTestId('safenet-check-status')).toHaveClass('MuiAlert-standardError')
  })

  it('explains an unavailable status without an explorer link', () => {
    render(
      <SafenetCheckStatus
        {...baseProps}
        explorerUrl={undefined}
        status={CheckStatus.UNAVAILABLE}
        unavailableReason="NO_CHECK"
      />,
    )
    expect(screen.getByText('Not checked by Safenet')).toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('shows the stale hint and calls refresh', () => {
    const onRefresh = jest.fn()
    render(<SafenetCheckStatus {...baseProps} status={CheckStatus.IN_PROGRESS} isStale onRefresh={onRefresh} />)
    expect(screen.getByText(/Showing the last known status/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }))
    expect(onRefresh).toHaveBeenCalledTimes(1)
  })

  it('offers to request a check only when unavailable and a handler is given', () => {
    const onRequestCheck = jest.fn()
    const { rerender } = render(
      <SafenetCheckStatus
        {...baseProps}
        status={CheckStatus.UNAVAILABLE}
        unavailableReason="NO_CHECK"
        onRequestCheck={onRequestCheck}
      />,
    )
    fireEvent.click(screen.getByTestId('safenet-request-check'))
    expect(onRequestCheck).toHaveBeenCalledTimes(1)

    rerender(<SafenetCheckStatus {...baseProps} status={CheckStatus.BENIGN} onRequestCheck={onRequestCheck} />)
    expect(screen.queryByTestId('safenet-request-check')).not.toBeInTheDocument()

    rerender(<SafenetCheckStatus {...baseProps} status={CheckStatus.UNAVAILABLE} unavailableReason="NO_CHECK" />)
    expect(screen.queryByTestId('safenet-request-check')).not.toBeInTheDocument()
  })

  it('reflects the request state', () => {
    const { rerender } = render(
      <SafenetCheckStatus
        {...baseProps}
        status={CheckStatus.UNAVAILABLE}
        unavailableReason="NO_CHECK"
        onRequestCheck={jest.fn()}
        requestState="requesting"
      />,
    )
    expect(screen.getByTestId('safenet-request-check')).toBeDisabled()

    rerender(
      <SafenetCheckStatus
        {...baseProps}
        status={CheckStatus.UNAVAILABLE}
        unavailableReason="NO_CHECK"
        onRequestCheck={jest.fn()}
        requestState="failed"
      />,
    )
    expect(screen.getByText(/The request failed/)).toBeInTheDocument()
  })

  it('hides the request button once a check was requested', () => {
    render(
      <SafenetCheckStatus
        {...baseProps}
        status={CheckStatus.UNAVAILABLE}
        unavailableReason="NO_CHECK"
        onRequestCheck={jest.fn()}
        requestState="requested"
      />,
    )
    expect(screen.queryByTestId('safenet-request-check')).not.toBeInTheDocument()
    expect(screen.getByText('Check requested')).toBeInTheDocument()
  })

  it('prefers the read-failure copy over the requested copy, without re-offering the button', () => {
    render(
      <SafenetCheckStatus
        {...baseProps}
        status={CheckStatus.UNAVAILABLE}
        unavailableReason="READ_FAILED"
        onRequestCheck={jest.fn()}
        requestState="requested"
      />,
    )
    expect(screen.getByText('Could not read status')).toBeInTheDocument()
    expect(screen.queryByText('Check requested')).not.toBeInTheDocument()
    expect(screen.queryByTestId('safenet-request-check')).not.toBeInTheDocument()
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
  })

  it('maps every public status to copy', () => {
    const statuses = [
      CheckStatus.SUBMITTED,
      CheckStatus.IN_PROGRESS,
      CheckStatus.BENIGN,
      CheckStatus.MALICIOUS,
      CheckStatus.DISPUTED,
      CheckStatus.TIMED_OUT,
    ] as const
    for (const status of statuses) {
      expect(getStatusCopy(status, undefined)).toBeDefined()
    }
    expect(getStatusCopy(CheckStatus.UNAVAILABLE, undefined)).toBeUndefined()
    expect(getStatusCopy(CheckStatus.UNAVAILABLE, 'READ_FAILED')?.severity).toBe('warning')
  })
})
