import { useContext, useEffect } from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { SafeTransaction } from '@safe-global/types-kit'
import EthSafeTransaction from '@safe-global/protocol-kit/dist/src/utils/transactions/SafeTransaction'
import SafeTxProvider, { SafeTxContext } from '../SafeTxProvider'
import { NO_FEE_FIELDS } from '@/services/tx/gasTokenFee'

const createTx = jest.fn()
jest.mock('@/services/tx/tx-sender', () => ({ createTx: (...args: unknown[]) => createTx(...args) }))
jest.mock('@/components/tx/shared/hooks', () => ({
  useRecommendedNonce: () => 2,
  useSafeTxGas: () => '99999',
}))

const makeTx = (data: Partial<SafeTransaction['data']> = {}): SafeTransaction =>
  new EthSafeTransaction({
    to: '0x1111111111111111111111111111111111111111',
    value: '0',
    data: '0x',
    operation: 0,
    nonce: 2,
    ...NO_FEE_FIELDS,
    ...data,
  })
const quotedTx = () =>
  makeTx({
    safeTxGas: '39090',
    baseGas: '71500',
    gasPrice: '1',
    gasToken: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
    refundReceiver: '0x798D0d04E1c52020d298b6246D9A87ceb4C08b36',
  })
const Probe = ({ initial }: { initial: SafeTransaction }) => {
  const { safeTx, setSafeTx, nonce, setNonce } = useContext(SafeTxContext)
  useEffect(() => {
    setSafeTx(initial)
  }, [initial, setSafeTx])
  return (
    <>
      <output data-testid="tx">{JSON.stringify(safeTx?.data)}</output>
      <output data-testid="nonce">{nonce}</output>
      <button onClick={() => setNonce(5)}>Change nonce</button>
      <button onClick={() => setSafeTx(quotedTx())}>Apply quote</button>
    </>
  )
}
const readTx = () => JSON.parse(screen.getByTestId('tx').textContent || '{}')
const renderWith = (initial: SafeTransaction) =>
  render(
    <SafeTxProvider>
      <Probe initial={initial} />
    </SafeTxProvider>,
  )

describe('SafeTxProvider', () => {
  beforeEach(() => {
    createTx.mockReset()
    createTx.mockImplementation((data, nonce) => Promise.resolve(makeTx({ ...data, nonce })))
  })

  it('preserves quoted gas instead of applying the recommendation', async () => {
    renderWith(quotedTx())
    await act(async () => {})
    expect(createTx).not.toHaveBeenCalled()
    expect(readTx()).toEqual(quotedTx().data)
  })

  it('changes an unsigned nonce without losing the signed fee fields', async () => {
    renderWith(quotedTx())
    fireEvent.click(screen.getByText('Change nonce'))
    await waitFor(() => expect(readTx().nonce).toBe(5))
    expect(readTx()).toEqual({ ...quotedTx().data, nonce: 5 })
    expect(screen.getByTestId('nonce')).toHaveTextContent('5')
  })

  it('discards a pending ordinary rebuild when a fee quote replaces the transaction', async () => {
    let resolve!: (tx: SafeTransaction) => void
    createTx.mockImplementationOnce(
      () =>
        new Promise<SafeTransaction>((done) => {
          resolve = done
        }),
    )
    renderWith(makeTx())
    await waitFor(() => expect(createTx).toHaveBeenCalledTimes(1))
    fireEvent.click(screen.getByText('Apply quote'))
    await act(async () => {
      resolve(makeTx({ safeTxGas: '99999' }))
    })
    expect(readTx()).toEqual(quotedTx().data)
  })

  it('keeps ordinary gas estimation working on other networks', async () => {
    renderWith(makeTx())
    await waitFor(() => expect(readTx().safeTxGas).toBe('99999'))
    expect(readTx().gasPrice).toBe('0')
  })

  it('does not change a transaction after the first signature', async () => {
    const initial = quotedTx()
    initial.signatures.set('owner', {
      signer: 'owner',
      data: '0x',
      isContractSignature: false,
      staticPart: () => '0x',
      dynamicPart: () => '',
    })
    renderWith(initial)
    fireEvent.click(screen.getByText('Change nonce'))
    await act(async () => {})
    expect(createTx).not.toHaveBeenCalled()
    expect(readTx().nonce).toBe(2)
  })
})
