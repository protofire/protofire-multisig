import { faker } from '@faker-js/faker'
import { act, render } from '@/tests/test-utils'
import * as useChains from '@/hooks/useChains'
import { chainBuilder } from '@/tests/builders/chains'
import { SafeCreationEvent, safeCreationDispatch } from '../../services/safeCreationEvents'
import CounterfactualSuccessScreen from './index'

describe('CounterfactualSuccessScreen', () => {
  const chains = Array.from({ length: 3 }, () =>
    chainBuilder()
      .with({ chainId: faker.string.numeric(8) })
      .build(),
  )

  beforeEach(() => {
    jest.spyOn(useChains, 'default').mockReturnValue({ configs: chains } as ReturnType<typeof useChains.default>)
    jest.spyOn(useChains, 'useChain').mockImplementation((id) => chains.find((c) => c.chainId === id))
    jest.spyOn(useChains, 'useCurrentChain').mockReturnValue(chains[0])
  })

  const dispatchAwaitingExecution = (networks: typeof chains) =>
    act(() => {
      safeCreationDispatch(SafeCreationEvent.AWAITING_EXECUTION, {
        groupKey: faker.string.uuid(),
        safeAddress: faker.finance.ethereumAddress(),
        networks,
      })
    })

  it('shows how many networks a multichain Safe was created on', () => {
    const { getByText, getAllByTestId } = render(<CounterfactualSuccessScreen />)

    dispatchAwaitingExecution(chains)

    expect(getByText('Created on 3 networks')).toBeInTheDocument()
    expect(getAllByTestId('chain-logo').length).toBeGreaterThanOrEqual(3)
  })

  it('does not show the count for a single network', () => {
    const { queryByText } = render(<CounterfactualSuccessScreen />)

    dispatchAwaitingExecution(chains.slice(0, 1))

    expect(queryByText(/Created on \d+ networks/)).not.toBeInTheDocument()
  })
})
