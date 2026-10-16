import type { DisplayModel } from '@ethereum-sourcify/clear-signing'
import { faker } from '@faker-js/faker'
import type { TransactionData } from '@safe-global/store/gateway/AUTO_GENERATED/transactions'
import { Operation } from '@safe-global/store/gateway/types'
import useChainId from '@/hooks/useChainId'
import * as useChains from '@/hooks/useChains'
import { act, render, waitFor } from '@/tests/test-utils'
import {
  ClearSigningLookupProvider,
  useClearSigningLookupContext,
  type ClearSigningLookupContextValue,
  type ClearSigningLookupOutcome,
} from './ClearSigningLookupContext'
import { getClearSigningLookupKey } from './lookupInputs'
import { useClearSigningOutcome } from './useClearSigningOutcome'

beforeEach(() => {
  jest.spyOn(useChains, 'useHasFeature').mockReturnValue(true)
})

const createTxData = (): TransactionData =>
  ({
    to: { value: faker.finance.ethereumAddress() },
    operation: Operation.CALL,
    value: '0',
    hexData: '0xa9059cbb' + '0'.repeat(128),
  }) as TransactionData

type Probe = {
  outcome: ClearSigningLookupOutcome | undefined
  context: ClearSigningLookupContextValue | null
  key: string
}

const OutcomeProbe = ({ txData, onValue }: { txData: TransactionData; onValue: (probe: Probe) => void }): null => {
  onValue({
    outcome: useClearSigningOutcome(txData),
    context: useClearSigningLookupContext(),
    key: getClearSigningLookupKey(useChainId(), txData),
  })
  return null
}

describe('useClearSigningOutcome', () => {
  it('returns undefined without a provider', () => {
    let probe: Probe | undefined
    render(<OutcomeProbe txData={createTxData()} onValue={(value) => (probe = value)} />)

    expect(probe?.outcome).toBeUndefined()
  })

  it('returns the outcome of the entry matching the transaction', async () => {
    let probe: Probe | undefined
    render(
      <ClearSigningLookupProvider>
        <OutcomeProbe txData={createTxData()} onValue={(value) => (probe = value)} />
      </ClearSigningLookupProvider>,
    )
    expect(probe?.outcome).toBeUndefined()

    act(() =>
      probe?.context?.registerEntry(probe.key, {
        label: 'Transfer',
        eligible: true,
        run: async () => ({ model: { intent: 'Send' } as DisplayModel }),
      }),
    )
    act(() => probe?.context?.requestLookup(probe.key))

    await waitFor(() => expect(probe?.outcome).toBe('found'))
  })
})
