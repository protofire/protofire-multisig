import { act, renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { server } from '@/tests/server'
import { useGasTokenSupport } from '../useGasTokenSupport'

let chainId = '77777'
let enabled = true
jest.mock('@/hooks/useChains', () => ({ useCurrentChain: () => ({ chainId }), useHasFeature: () => enabled }))
jest.mock('@/config/gateway', () => ({ GATEWAY_URL: 'https://gateway.test' }))
const token = { address: '0x1111111111111111111111111111111111111111', symbol: 'USDTest', decimals: 8 }
const nextToken = { address: '0x2222222222222222222222222222222222222222', symbol: 'USDC', decimals: 6 }
const receiver = '0x798D0d04E1c52020d298b6246D9A87ceb4C08b36'
const request = jest.fn()
beforeEach(() =>
  server.use(
    http.get('https://gateway.test/v1/chains/:chain/fees', ({ params }) => {
      request(params.chain)
      return HttpResponse.json({ gasTokens: [params.chain === '77777' ? token : nextToken], refundReceiver: receiver })
    }),
  ),
)
beforeEach(() => {
  chainId = '77777'
  enabled = true
  request.mockClear()
})

it('uses gateway token metadata on a chain without a frontend token configuration', async () => {
  const { result } = renderHook(() => useGasTokenSupport())
  expect(result.current.isSupported).toBe(false)
  expect(result.current.isLoading).toBe(true)
  await waitFor(() => expect(result.current.isSupported).toBe(true))
  expect(result.current.gasToken).toEqual(token)
  expect(result.current.refundReceiver).toBe(receiver)
})

it('does not request fee configuration when the feature is off', () => {
  enabled = false
  const { result } = renderHook(() => useGasTokenSupport())
  expect(result.current.isSupported).toBe(false)
  expect(result.current.isLoading).toBe(false)
  expect(request).not.toHaveBeenCalled()
})

it('clears old support immediately when switching chains', async () => {
  const { result, rerender } = renderHook(() => useGasTokenSupport())
  await waitFor(() => expect(result.current.isSupported).toBe(true))
  chainId = '77778'
  rerender()
  expect(result.current.isSupported).toBe(false)
  expect(result.current.isLoading).toBe(true)
  await waitFor(() => expect(result.current.gasToken).toEqual(nextToken))
})

it('preserves the token of an existing transaction instead of replacing it with the first configured token', async () => {
  server.use(
    http.get('https://gateway.test/v1/chains/:chain/fees', () =>
      HttpResponse.json({ gasTokens: [token, nextToken], refundReceiver: receiver }),
    ),
  )
  const { result } = renderHook(() => useGasTokenSupport(nextToken.address))
  await waitFor(() => expect(result.current.gasToken).toEqual(nextToken))
})

it.each([null, receiver])(
  'does not advertise support for an empty allowlist with receiver %s',
  async (refundReceiver) => {
    server.use(
      http.get('https://gateway.test/v1/chains/:chain/fees', () =>
        HttpResponse.json({ gasTokens: [], refundReceiver }),
      ),
    )
    const { result } = renderHook(() => useGasTokenSupport())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.isSupported).toBe(false)
  },
)

it('requires a refund receiver before advertising a token', async () => {
  server.use(
    http.get('https://gateway.test/v1/chains/:chain/fees', () =>
      HttpResponse.json({ gasTokens: [token], refundReceiver: null }),
    ),
  )
  const { result } = renderHook(() => useGasTokenSupport())
  await waitFor(() => expect(result.current.isLoading).toBe(false))
  expect(result.current.isSupported).toBe(false)
  expect(result.current.gasToken).toBeUndefined()
})

it('exposes lookup errors without claiming support', async () => {
  server.use(http.get('https://gateway.test/v1/chains/:chain/fees', () => new HttpResponse(null, { status: 503 })))
  const { result } = renderHook(() => useGasTokenSupport())
  await waitFor(() => expect(result.current.error).toBeDefined())
  expect(result.current.isSupported).toBe(false)
})

it('retries a failed support lookup without retaining stale availability', async () => {
  server.use(http.get('https://gateway.test/v1/chains/:chain/fees', () => new HttpResponse(null, { status: 503 })))
  const { result } = renderHook(() => useGasTokenSupport())
  await waitFor(() => expect(result.current.error).toBeDefined())
  server.use(
    http.get('https://gateway.test/v1/chains/:chain/fees', () =>
      HttpResponse.json({ gasTokens: [token], refundReceiver: receiver }),
    ),
  )
  act(() => result.current.retry())
  expect(result.current.isSupported).toBe(false)
  await waitFor(() => expect(result.current.gasTokens).toEqual([token]))
  expect(result.current.error).toBeUndefined()
})
