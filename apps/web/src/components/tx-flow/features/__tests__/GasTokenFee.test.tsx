import { useContext, useEffect, useState } from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { server } from '@/tests/server'
import EthSafeTransaction from '@safe-global/protocol-kit/dist/src/utils/transactions/SafeTransaction'
import type { SafeTransaction } from '@safe-global/types-kit'
import SafeTxProvider, { SafeTxContext } from '../../SafeTxProvider'
import { TxFlowContext, initialContext } from '../../TxFlowProvider'
import { GasTokenFee } from '../GasTokenFee'
import { ERC20__factory } from '@safe-global/utils/types/contracts'
import { JsonRpcProvider, Interface, AbiCoder } from 'ethers'
import { MULTICALL_ABI } from '@safe-global/utils/utils/multicall'
import * as web3 from '@/hooks/wallets/web3'
import { NO_FEE_FIELDS } from '@/services/tx/gasTokenFee'

const dai = { address: '0x2222222222222222222222222222222222222222', symbol: 'DAI', decimals: 18 }
const token = { address: '0x1111111111111111111111111111111111111111', symbol: 'USDTest', decimals: 8 }
const usdc = { address: '0x3333333333333333333333333333333333333333', symbol: 'USDC', decimals: 6 }
const NATIVE = { address: '0x0000000000000000000000000000000000000000', symbol: 'USDC', decimals: 18 }
const receiver = '0x798D0d04E1c52020d298b6246D9A87ceb4C08b36'
const fields = {
  safeTxGas: '39090',
  baseGas: '71500',
  gasPrice: '1',
  gasToken: token.address,
  refundReceiver: receiver,
  numberSignatures: 2,
}
const initial = new EthSafeTransaction({
  to: receiver,
  value: '0',
  data: '0x',
  operation: 0,
  nonce: 2,
  ...NO_FEE_FIELDS,
})
const createTx = jest.fn()
const support = { gasTokens: [token], isSupported: true, isLoading: false, gasToken: token, refundReceiver: receiver }
jest.mock('@/hooks/useGasTokenSupport', () => ({ useGasTokenSupport: () => support }))
jest.mock('@/hooks/useChains', () => ({ useCurrentChain: () => ({ chainId: '84532' }), useHasFeature: () => true }))
jest.mock('@/hooks/useSafeInfo', () => () => ({
  safe: { threshold: 2 },
  safeAddress: '0x1111111111111111111111111111111111111111',
}))
jest.mock('@/components/tx/shared/hooks', () => ({ useRecommendedNonce: () => 2, useSafeTxGas: () => '0' }))
jest.mock('@/services/tx/tx-sender', () => ({ createTx: (...args: unknown[]) => createTx(...args) }))
jest.mock('@/config/gateway', () => ({
  ...jest.requireActual('@/config/gateway'),
  GATEWAY_URL: 'https://gateway.test',
}))

const provider = new JsonRpcProvider('https://rpc.test', 84532, {
  staticNetwork: true,
  batchMaxCount: 1,
  cacheTimeout: -1,
})
let balances: Record<string, bigint> = {}
afterAll(() => provider.destroy())
beforeEach(() => {
  support.gasTokens = [token]
  balances = { [token.address]: 1000000000n }
  jest.spyOn(web3, 'useWeb3ReadOnly').mockReturnValue(provider)
  server.use(
    http.post('https://rpc.test', async ({ request }) => {
      const body = (await request.json()) as { id: number; method: string; params: { to: string; data: string }[] }
      if (body.method === 'eth_getBalance') {
        const native = '0x' + (balances[NATIVE.address] ?? 0n).toString(16)
        return HttpResponse.json({ jsonrpc: '2.0', id: body.id, result: native })
      }
      const call = body.params[0]
      const abi = new Interface(MULTICALL_ABI)
      const encode = (address: string) =>
        AbiCoder.defaultAbiCoder().encode(['uint256'], [balances[address.toLowerCase()] ?? 0n])
      const result = call.data.startsWith(abi.getFunction('aggregate3')!.selector)
        ? abi.encodeFunctionResult('aggregate3', [
            abi
              .decodeFunctionData('aggregate3', call.data)[0]
              .map((entry: { target: string }) => ({ success: true, returnData: encode(entry.target) })),
          ])
        : encode(call.to)
      return HttpResponse.json({ jsonrpc: '2.0', id: body.id, result })
    }),
    http.post('https://gateway.test/v1/chains/84532/fees/:safe/preview', async ({ request }) => {
      const body = (await request.json()) as { gasToken: string }
      return HttpResponse.json({ txData: { ...fields, gasToken: body.gasToken } })
    }),
  )
})

const Flow = ({ transaction = initial }: { transaction?: SafeTransaction }) => {
  const { safeTx, setSafeTx, setNonce } = useContext(SafeTxContext)
  const [disabled, setDisabled] = useState(false)
  const [step, setStep] = useState(0)
  useEffect(() => {
    setSafeTx(transaction)
  }, [setSafeTx, transaction])
  return (
    <TxFlowContext.Provider
      value={{ ...initialContext, isCreation: true, isSubmitDisabled: disabled, setIsSubmitDisabled: setDisabled }}
    >
      {safeTx && (step === 0 ? <GasTokenFee /> : <output data-testid="receipt">{JSON.stringify(safeTx.data)}</output>)}
      <button disabled={disabled} onClick={() => setStep(1)}>
        Continue
      </button>
      <button onClick={() => setStep(0)}>Back</button>
      <button onClick={() => setNonce(3)}>Change nonce</button>
      <button onClick={() => setSafeTx(new EthSafeTransaction(initial.data))}>Refresh transaction</button>
      <output data-testid="tx">{JSON.stringify(safeTx?.data)}</output>
    </TxFlowContext.Provider>
  )
}
const renderFlow = (transaction?: SafeTransaction) =>
  render(
    <SafeTxProvider>
      <Flow transaction={transaction} />
    </SafeTxProvider>,
  )
const readTx = () => JSON.parse(screen.getByTestId('tx').textContent || '{}')

beforeEach(() => {
  createTx.mockReset().mockImplementation((data, nonce) => Promise.resolve(new EthSafeTransaction({ ...data, nonce })))
})

describe('GasTokenFee', () => {
  it('waits for the complete quote and preserves it across Continue and Back for a two-owner Safe', async () => {
    let release!: () => void
    let requestBody: unknown
    const pending = new Promise<void>((resolve) => {
      release = resolve
    })
    server.use(
      http.post('https://gateway.test/v1/chains/84532/fees/:safe/preview', async ({ request }) => {
        requestBody = await request.json()
        await pending
        return HttpResponse.json({ txData: fields })
      }),
    )
    renderFlow()
    expect(screen.getByText('Pay from Safe')).toBeInTheDocument()
    expect(screen.getByRole('checkbox')).toBeDisabled()
    await act(async () => {
      release()
    })
    await waitFor(() => expect(screen.getByRole('checkbox')).toBeEnabled())
    fireEvent.click(screen.getByRole('checkbox'))
    await waitFor(() => expect(readTx().gasPrice).toBe('1'))
    await waitFor(() => expect(screen.getByText('Continue')).toBeEnabled())
    expect(requestBody).toEqual(expect.objectContaining({ numberSignatures: 2 }))
    fireEvent.click(screen.getByText('Continue'))
    expect(JSON.parse(screen.getByTestId('receipt').textContent || '{}')).toEqual(
      expect.objectContaining({ gasToken: token.address, refundReceiver: receiver, baseGas: '71500' }),
    )
    fireEvent.click(screen.getByText('Back'))
    expect(screen.getByRole('checkbox')).toBeChecked()
  })

  it('keeps the selected fee when another review component refreshes the same call', async () => {
    renderFlow()
    await waitFor(() => expect(screen.getByRole('checkbox')).toBeEnabled())
    fireEvent.click(screen.getByRole('checkbox'))
    await waitFor(() => expect(readTx().gasPrice).toBe('1'))
    fireEvent.click(screen.getByText('Refresh transaction'))
    await waitFor(() => expect(readTx().gasPrice).toBe('1'))
    expect(readTx().refundReceiver).toBe(receiver)
  })

  it('blocks Continue on quote failure until the user explicitly turns off Safe payment', async () => {
    renderFlow()
    await waitFor(() => expect(screen.getByRole('checkbox')).toBeEnabled())
    fireEvent.click(screen.getByRole('checkbox'))
    await waitFor(() => expect(readTx().gasPrice).toBe('1'))
    server.use(
      http.post('https://gateway.test/v1/chains/84532/fees/:safe/preview', () =>
        HttpResponse.json({ message: 'Insufficient USDC' }, { status: 422 }),
      ),
    )
    fireEvent.click(screen.getByText('Refresh balances and fees'))
    await screen.findByText(/Couldn’t load balances or estimate the fee/)
    expect(screen.getByRole('checkbox')).toBeChecked()
    expect(screen.getByText('Continue')).toBeDisabled()
    fireEvent.click(screen.getByRole('checkbox'))
    await waitFor(() => expect(screen.getByText('Continue')).toBeEnabled())
    expect(readTx()).toEqual(initial.data)
  })

  it('does not select or replace an unrelated token refund', async () => {
    const foreign = new EthSafeTransaction({
      ...initial.data,
      ...fields,
      gasToken: '0x2222222222222222222222222222222222222222',
    })
    renderFlow(foreign)
    await waitFor(() => expect(readTx().gasToken).toBe(foreign.data.gasToken))
    expect(screen.getByRole('checkbox')).not.toBeChecked()
    expect(screen.getByText('Continue')).toBeEnabled()
    expect(readTx().refundReceiver).toBe(receiver)
  })

  it('finishes clearing fee fields if the nonce changes while payment is being turned off', async () => {
    renderFlow()
    await waitFor(() => expect(screen.getByRole('checkbox')).toBeEnabled())
    fireEvent.click(screen.getByRole('checkbox'))
    await waitFor(() => expect(readTx().gasPrice).toBe('1'))
    let release!: () => void
    const clearing = new Promise<void>((resolve) => {
      release = resolve
    })
    createTx.mockImplementationOnce(async (data, nonce) => {
      await clearing
      return new EthSafeTransaction({ ...data, nonce })
    })
    fireEvent.click(screen.getByRole('checkbox'))
    expect(screen.getByText('Continue')).toBeDisabled()
    fireEvent.click(screen.getByText('Change nonce'))
    await act(async () => {
      release()
    })
    await waitFor(() => expect(screen.getByText('Continue')).toBeEnabled())
    expect(readTx()).toEqual(expect.objectContaining({ ...NO_FEE_FIELDS, nonce: 3 }))
  })

  it('does not apply a delayed quote after the user turns the toggle off', async () => {
    renderFlow()
    await waitFor(() => expect(screen.getByRole('checkbox')).toBeEnabled())
    fireEvent.click(screen.getByRole('checkbox'))
    await waitFor(() => expect(readTx().gasPrice).toBe('1'))
    let release!: () => void
    const pending = new Promise<void>((resolve) => {
      release = resolve
    })
    server.use(
      http.post('https://gateway.test/v1/chains/84532/fees/:safe/preview', async () => {
        await pending
        return HttpResponse.json({ txData: fields })
      }),
    )
    fireEvent.click(screen.getByText('Refresh balances and fees'))
    fireEvent.click(screen.getByRole('checkbox'))
    await act(async () => {
      release()
    })
    await waitFor(() => expect(screen.getByText('Continue')).toBeEnabled())
    expect(readTx().gasPrice).toBe('0')
  })
})

describe('fee token choices', () => {
  it('uses a fixed label for one configured token', async () => {
    renderFlow()
    await waitFor(() => expect(screen.getByRole('checkbox')).toBeEnabled())
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    expect(screen.getByText('Fee token: USDTest')).toBeInTheDocument()
  })

  it('selects the first affordable token and disables an unfunded alternative', async () => {
    support.gasTokens = [token, dai]
    balances = { [dai.address]: 10n ** 18n }
    renderFlow()
    await waitFor(() => expect(screen.getByRole('checkbox')).toBeEnabled())
    fireEvent.click(screen.getByRole('checkbox'))
    await waitFor(() => expect(readTx().gasToken).toBe(dai.address))
    fireEvent.mouseDown(screen.getByRole('combobox'))
    expect(screen.getByRole('option', { name: /USDTest/ })).toHaveAttribute('aria-disabled', 'true')
  })

  it('warns that a 6-decimal fee token costs more and names the cheaper token', async () => {
    support.gasTokens = [usdc, dai]
    balances = { [usdc.address]: 10n ** 6n, [dai.address]: 10n ** 18n }
    renderFlow()
    await waitFor(() => expect(screen.getByRole('checkbox')).toBeEnabled())
    expect(screen.getByText(/USDC has 6 decimals.*Pay in DAI for a lower fee/)).toBeInTheDocument()
    fireEvent.mouseDown(screen.getByRole('combobox'))
    fireEvent.click(screen.getByRole('option', { name: /DAI/ }))
    await waitFor(() => expect(screen.queryByText(/has 6 decimals/)).not.toBeInTheDocument())
  })

  it('does not warn for a token with more than 6 decimals', async () => {
    renderFlow()
    await waitFor(() => expect(screen.getByRole('checkbox')).toBeEnabled())
    expect(screen.queryByText(/decimals/)).not.toBeInTheDocument()
  })

  it('keeps a token balance and explains a failed preview in the token menu', async () => {
    support.gasTokens = [token, dai]
    balances = { [token.address]: 1000000000n, [dai.address]: 10n ** 18n }
    server.use(
      http.post('https://gateway.test/v1/chains/84532/fees/:safe/preview', async ({ request }) => {
        const body = (await request.json()) as { gasToken: string }
        if (body.gasToken === dai.address) {
          return HttpResponse.json({ message: 'DAI quote unavailable' }, { status: 422 })
        }
        return HttpResponse.json({ txData: { ...fields, gasToken: body.gasToken } })
      }),
    )
    renderFlow()
    await waitFor(() => expect(screen.getByRole('checkbox')).toBeEnabled())
    fireEvent.mouseDown(screen.getByRole('combobox'))
    expect(screen.getByRole('option', { name: /DAI.*Available: 1 DAI.*DAI quote unavailable/ })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
  })

  it('changes the unsigned fee token and preserves the explicit selection when its balance falls', async () => {
    support.gasTokens = [token, dai]
    balances[dai.address] = 10n ** 18n
    renderFlow()
    await waitFor(() => expect(screen.getByRole('checkbox')).toBeEnabled())
    fireEvent.click(screen.getByRole('checkbox'))
    await waitFor(() => expect(readTx().gasToken).toBe(token.address))
    fireEvent.mouseDown(screen.getByRole('combobox'))
    fireEvent.click(screen.getByRole('option', { name: /DAI/ }))
    await waitFor(() => expect(readTx().gasToken).toBe(dai.address))
    balances[dai.address] = 0n
    fireEvent.click(screen.getByText('Refresh balances and fees'))
    await screen.findByText(/Not enough DAI/)
    expect(screen.getByText('Continue')).toBeDisabled()
    expect(screen.getByRole('checkbox')).toBeChecked()
    expect(readTx().gasToken).toBe(dai.address)
  })

  it.each([0n, 1n])('keeps wallet payment available with insufficient token balance %s', async (balance) => {
    balances[token.address] = balance
    renderFlow()
    await screen.findByText(/Add USDTest to this Safe/)
    expect(screen.getByRole('checkbox')).toBeDisabled()
    expect(screen.getByText('Continue')).toBeEnabled()
    expect(readTx().gasPrice).toBe('0')
  })

  it('reserves the transfer amount as well as the fee', async () => {
    balances[token.address] = 1000000n
    const tx = new EthSafeTransaction({
      ...initial.data,
      to: token.address,
      data: ERC20__factory.createInterface().encodeFunctionData('transfer', [receiver, 950000n]),
    })
    renderFlow(tx)
    await screen.findByText(/Add USDTest to this Safe/)
    expect(screen.getByRole('checkbox')).toBeDisabled()
  })

  it('distinguishes a failed balance lookup from an empty balance', async () => {
    server.use(
      http.post('https://rpc.test', () =>
        HttpResponse.json({ jsonrpc: '2.0', id: 1, error: { code: -32000, message: 'RPC unavailable' } }),
      ),
    )
    renderFlow()
    await screen.findByText(/Couldn’t load balances or estimate the fee/)
    expect(screen.queryByText(/Add USDTest/)).not.toBeInTheDocument()
    expect(screen.getByText('Continue')).toBeEnabled()
  })
})

describe('native fee token', () => {
  it('reads the native balance from the node, shows it, and labels the fee as a maximum', async () => {
    support.gasTokens = [token, NATIVE]
    balances = { [NATIVE.address]: 10n ** 18n }
    renderFlow()
    await waitFor(() => expect(screen.getByRole('checkbox')).toBeEnabled())
    fireEvent.click(screen.getByRole('checkbox'))
    await waitFor(() => expect(readTx().gasPrice).toBe('1'))
    expect(readTx().gasToken).toBe(NATIVE.address)
    expect(readTx().refundReceiver).toBe(receiver)
    expect(await screen.findByText(/^Available: 1(\.0+)? USDC$/)).toBeInTheDocument()
    fireEvent.mouseDown(screen.getByRole('combobox'))
    expect(screen.getByRole('option', { name: /USDC/ })).toHaveTextContent(/Fee: up to ≈ /)
    expect(screen.getByRole('option', { name: /USDTest/ })).toHaveAttribute('aria-disabled', 'true')
  })

  it('does not show the 6-decimal warning for native USDC with 18 decimals', async () => {
    support.gasTokens = [NATIVE, usdc]
    balances = { [NATIVE.address]: 10n ** 18n, [usdc.address]: 10n ** 6n }
    renderFlow()
    await waitFor(() => expect(screen.getByRole('checkbox')).toBeEnabled())
    fireEvent.click(screen.getByRole('checkbox'))
    await waitFor(() => expect(readTx().gasToken).toBe(NATIVE.address))
    expect(screen.queryByText(/has 6 decimals/)).not.toBeInTheDocument()
  })

  it('marks the native entry insufficient when the balance does not cover the fee', async () => {
    support.gasTokens = [NATIVE]
    balances = { [NATIVE.address]: 5n }
    renderFlow()
    await screen.findByText(/Add USDC to this Safe/)
    expect(screen.getByRole('checkbox')).toBeDisabled()
  })
})
