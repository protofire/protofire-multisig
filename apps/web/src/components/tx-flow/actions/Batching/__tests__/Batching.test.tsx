import { type ReactElement } from 'react'
import { fireEvent, waitFor } from '@testing-library/react'
import { render as renderTestUtils } from '@/tests/test-utils'
import { Batching } from '../index'
import BatchingSlot from '../index'
import { SafeTxContext, type SafeTxContextParams } from '@/components/tx-flow/SafeTxProvider'
import { initialContext, TxFlowContext, type TxFlowContextType } from '@/components/tx-flow/TxFlowProvider'
import { TxModalContext } from '@/components/tx-flow'
import { SlotName, SlotProvider, useSlotIds } from '@/components/tx-flow/slots'
import { createMockSafeTransaction } from '@/tests/transactions'
import { OperationType } from '@safe-global/types-kit'
import * as txHooks from '@/components/tx/shared/hooks'
import * as counterfactual from '@/features/counterfactual'
import * as useIsSafeOwner from '@/hooks/useIsSafeOwner'

jest.mock('@/components/tx/shared/hooks', () => ({
  useTxActions: jest.fn(),
}))

jest.mock('@/hooks/useIsSafeOwner', () => ({
  __esModule: true,
  default: jest.fn(),
}))

jest.mock('@/features/counterfactual', () => ({
  useIsCounterfactualSafe: jest.fn(),
}))

const SlotIds = () => <span data-testid="slot-ids">{useSlotIds(SlotName.ComboSubmit).join(',')}</span>

const renderWithContexts = (
  ui: ReactElement,
  safeTx = createMockSafeTransaction({ to: '0x1', data: '0x', operation: OperationType.Call }),
) =>
  renderTestUtils(
    <TxModalContext.Provider value={{ txFlow: undefined, setTxFlow: jest.fn(), setFullWidth: jest.fn() }}>
      <TxFlowContext.Provider value={{ ...initialContext, isCreation: true } as TxFlowContextType}>
        <SafeTxContext.Provider
          value={{ safeTx, setSafeTx: jest.fn(), setSafeTxError: jest.fn() } as unknown as SafeTxContextParams}
        >
          <SlotProvider>{ui}</SlotProvider>
        </SafeTxContext.Provider>
      </TxFlowContext.Provider>
    </TxModalContext.Provider>,
  )

describe('Batching', () => {
  const tokenRefundTx = createMockSafeTransaction({
    to: '0x1',
    data: '0x',
    operation: OperationType.Call,
  })
  Object.assign(tokenRefundTx.data, {
    gasPrice: '1',
    gasToken: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
    refundReceiver: '0x798D0d04E1c52020d298b6246D9A87ceb4C08b36',
  })

  beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(useIsSafeOwner, 'default').mockReturnValue(true)
    jest.spyOn(counterfactual, 'useIsCounterfactualSafe').mockReturnValue(false)
  })

  it('does not register Add to batch for a token-refund transaction', async () => {
    const { getByTestId } = renderWithContexts(
      <>
        <BatchingSlot />
        <SlotIds />
      </>,
      tokenRefundTx,
    )

    await waitFor(() => expect(getByTestId('slot-ids')).toHaveTextContent(''))
  })

  it('does not submit a token-refund transaction when the handler is invoked', async () => {
    const addToBatch = jest.fn().mockResolvedValue('tx-id')
    jest
      .spyOn(txHooks, 'useTxActions')
      .mockReturnValue({ addToBatch } as unknown as ReturnType<typeof txHooks.useTxActions>)

    const { getByRole } = renderWithContexts(
      <Batching options={[{ id: 'batching', label: 'Add to batch' }]} onChange={jest.fn()} slotId="batching" />,
      tokenRefundTx,
    )

    fireEvent.click(getByRole('button', { name: 'Add to batch' }))
    await waitFor(() => expect(addToBatch).not.toHaveBeenCalled())
  })
})
