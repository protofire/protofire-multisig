import { faker } from '@faker-js/faker'

import { render } from '@/tests/test-utils'
import { useIsRecoverySupported } from '@/features/recovery/hooks/useIsRecoverySupported'
import { useRecoveryQueue, useUnavailableRecoveryQueue } from '@/features/recovery/hooks/useRecoveryQueue'
import useRecovery from '@/features/recovery/hooks/useRecovery'
import RecoveryList from '.'

jest.mock('@/features/recovery/hooks/useIsRecoverySupported')
jest.mock('@/features/recovery/hooks/useRecoveryQueue')
jest.mock('@/features/recovery/hooks/useRecovery')

const mockUseIsRecoverySupported = useIsRecoverySupported as jest.MockedFunction<typeof useIsRecoverySupported>
const mockUseRecoveryQueue = useRecoveryQueue as jest.MockedFunction<typeof useRecoveryQueue>
const mockUseUnavailableRecoveryQueue = useUnavailableRecoveryQueue as jest.MockedFunction<
  typeof useUnavailableRecoveryQueue
>
const mockUseRecovery = useRecovery as jest.MockedFunction<typeof useRecovery>

describe('RecoveryList', () => {
  beforeEach(() => {
    mockUseIsRecoverySupported.mockReturnValue(true)
    mockUseRecoveryQueue.mockReturnValue([])
    mockUseUnavailableRecoveryQueue.mockReturnValue([])
  })

  it('should show an error instead of an empty queue when recovery data cannot be loaded', () => {
    mockUseRecovery.mockReturnValue([undefined, new Error('Recovery transaction 1 not found'), false])

    const { getByTestId } = render(<RecoveryList />)

    expect(getByTestId('recovery-error')).toBeInTheDocument()
  })

  it('should render nothing when there is no queue and recovery data loaded', () => {
    mockUseRecovery.mockReturnValue([[], undefined, false])

    const { queryByTestId } = render(<RecoveryList />)

    expect(queryByTestId('recovery-error')).not.toBeInTheDocument()
  })

  it('should show a queued proposal whose details could not be loaded, so that it can be cancelled', () => {
    mockUseRecovery.mockReturnValue([[], undefined, false])
    mockUseUnavailableRecoveryQueue.mockReturnValue([
      {
        address: faker.finance.ethereumAddress(),
        args: { queueNonce: 0n, txHash: faker.string.hexadecimal({ length: 64 }) },
        timestamp: BigInt(Date.now() - 120_000),
        validFrom: BigInt(Date.now() - 60_000),
        expiresAt: null,
      },
    ])

    const { getByTestId, getByText, queryByTestId } = render(<RecoveryList />)

    expect(getByTestId('unavailable-recovery-item')).toBeInTheDocument()
    expect(getByText('Details unavailable')).toBeInTheDocument()
    expect(getByTestId('cancel-recovery-btn')).toBeInTheDocument()
    expect(queryByTestId('recovery-error')).not.toBeInTheDocument()
  })
})
