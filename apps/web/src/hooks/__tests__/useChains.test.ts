import { renderHook } from '@/tests/test-utils'
import useChains from '@/hooks/useChains'
import * as gatewayApi from '@safe-global/store/gateway'
import { STATIC_CHAINS_REQUEST_ID_PREFIX } from '@/store'
import { chainBuilder } from '@/tests/builders/chains'
import type { EntityState } from '@reduxjs/toolkit'
import type { Chain } from '@safe-global/store/gateway/AUTO_GENERATED/chains'

describe('useChains', () => {
  const mockChain = chainBuilder().with({ chainId: '1' }).build()
  const mockEntityState: EntityState<Chain, string> = {
    ids: [mockChain.chainId],
    entities: { [mockChain.chainId]: mockChain },
  }
  const staticRequestId = `${STATIC_CHAINS_REQUEST_ID_PREFIX}${Date.now()}`

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('reports isRuntimeData as false for the seeded snapshot (static requestId, fulfilled)', () => {
    jest.spyOn(gatewayApi, 'useGetChainsConfigQuery').mockReturnValue({
      data: mockEntityState,
      error: undefined,
      isLoading: false,
      isFetching: false,
      isSuccess: true,
      isError: false,
      requestId: staticRequestId,
      fulfilledTimeStamp: Date.now(),
    } as any)

    const { result } = renderHook(() => useChains())

    expect(result.current.configs).toEqual([mockChain])
    expect(result.current.isRuntimeData).toBe(false)
  })

  it('reports isRuntimeData as false while the runtime fetch is pending (new requestId, isFetching, still serving seeded data)', () => {
    jest.spyOn(gatewayApi, 'useGetChainsConfigQuery').mockReturnValue({
      data: mockEntityState,
      error: undefined,
      isLoading: false,
      isFetching: true,
      isSuccess: true,
      isError: false,
      requestId: 'runtime-request-id',
      fulfilledTimeStamp: Date.now(),
    } as any)

    const { result } = renderHook(() => useChains())

    expect(result.current.isRuntimeData).toBe(false)
  })

  it('reports isRuntimeData as true once the runtime fetch has fulfilled', () => {
    jest.spyOn(gatewayApi, 'useGetChainsConfigQuery').mockReturnValue({
      data: mockEntityState,
      error: undefined,
      isLoading: false,
      isFetching: false,
      isSuccess: true,
      isError: false,
      requestId: 'runtime-request-id',
      fulfilledTimeStamp: Date.now(),
    } as any)

    const { result } = renderHook(() => useChains())

    expect(result.current.isRuntimeData).toBe(true)
  })

  it('reports isRuntimeData as true (fallback) once the runtime fetch has rejected', () => {
    jest.spyOn(gatewayApi, 'useGetChainsConfigQuery').mockReturnValue({
      data: mockEntityState,
      error: { status: 500 },
      isLoading: false,
      isFetching: false,
      isSuccess: false,
      isError: true,
      requestId: 'runtime-request-id',
      fulfilledTimeStamp: undefined,
    } as any)

    const { result } = renderHook(() => useChains())

    expect(result.current.isRuntimeData).toBe(true)
  })

  it('reports isRuntimeData as false before any request has started', () => {
    jest.spyOn(gatewayApi, 'useGetChainsConfigQuery').mockReturnValue({
      data: undefined,
      error: undefined,
      isLoading: true,
      isFetching: true,
      isSuccess: false,
      isError: false,
      requestId: undefined,
    } as any)

    const { result } = renderHook(() => useChains())

    expect(result.current.isRuntimeData).toBe(false)
  })
})
