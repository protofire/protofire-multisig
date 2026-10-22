import { render } from '@/tests/test-utils'
import useRecovery from '@/features/recovery/hooks/useRecovery'
import RecoverySettings from '.'

jest.mock('@/features/recovery/hooks/useRecovery')

const mockUseRecovery = useRecovery as jest.MockedFunction<typeof useRecovery>

describe('RecoverySettings', () => {
  it('should show an error instead of the setup button if recovery data cannot be loaded', () => {
    mockUseRecovery.mockReturnValue([undefined, new Error('Recovery transaction 0 not found'), false])

    const { getByTestId, queryByTestId } = render(<RecoverySettings />)

    expect(getByTestId('recovery-error')).toBeInTheDocument()
    expect(queryByTestId('setup-recovery-btn')).not.toBeInTheDocument()
  })

  it('should not offer to set up recovery while recovery data is still loading', () => {
    mockUseRecovery.mockReturnValue([undefined, undefined, true])

    const { queryByTestId } = render(<RecoverySettings />)

    expect(queryByTestId('setup-recovery-btn')).not.toBeInTheDocument()
    expect(queryByTestId('recovery-error')).not.toBeInTheDocument()
  })

  it('should show the setup button if recovery is not enabled', () => {
    mockUseRecovery.mockReturnValue([[], undefined, false])

    const { getByTestId, queryByTestId } = render(<RecoverySettings />)

    expect(getByTestId('setup-recovery-btn')).toBeInTheDocument()
    expect(queryByTestId('recovery-error')).not.toBeInTheDocument()
  })
})
