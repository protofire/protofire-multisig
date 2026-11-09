import { backOff } from 'exponential-backoff'
import { SAFENET_PROXY_URL } from '@safe-global/utils/features/safenet-checks/constants'

export type RequestSafenetCheckParams = {
  chainId: string
  safeAddress: string
  safeTxHash: string
}

export type RequestFailure = 'failed' | 'underfunded'

const RETRY_OPTIONS = { numOfAttempts: 4, startingDelay: 1_000, timeMultiple: 2 }

export class SafenetProxyError extends Error {
  constructor(readonly status: number) {
    super(`Safenet proxy responded with ${status}`)
    this.name = 'SafenetProxyError'
  }
}

const isTransient = (error: unknown): boolean =>
  error instanceof SafenetProxyError ? error.status === 408 || error.status === 429 || error.status >= 500 : true

const propose = async ({ chainId, safeAddress, safeTxHash }: RequestSafenetCheckParams): Promise<void> => {
  const response = await fetch(`${SAFENET_PROXY_URL}/propose`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({
      type: 'PENDING_MULTISIG_TRANSACTION',
      chainId,
      address: safeAddress,
      safeTxHash,
    }),
  })
  if (!response.ok) throw new SafenetProxyError(response.status)
}

export const toRequestFailure = (error: unknown): RequestFailure =>
  error instanceof SafenetProxyError && error.status === 402 ? 'underfunded' : 'failed'

export const requestSafenetCheck = (params: RequestSafenetCheckParams): Promise<void> =>
  backOff(() => propose(params), { ...RETRY_OPTIONS, retry: isTransient })
