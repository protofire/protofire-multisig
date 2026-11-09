import { http, HttpResponse, type JsonBodyType } from 'msw'
import { server } from '@/tests/server'
import { requestSafenetCheck, SafenetProxyError, toRequestFailure } from '../requestSafenetCheck'

jest.mock('@safe-global/utils/features/safenet-checks/constants', () => ({
  ...jest.requireActual('@safe-global/utils/features/safenet-checks/constants'),
  SAFENET_PROXY_URL: 'http://localhost:8787',
}))

const PROPOSE_URL = 'http://localhost:8787/propose'

type Reply = number | 'network-error' | { status: number; body: JsonBodyType }

/** Serves the given replies in order and the last one thereafter; returns the received bodies. */
const serveReplies = (...replies: Reply[]): unknown[] => {
  const bodies: unknown[] = []
  server.use(
    http.post(PROPOSE_URL, async ({ request }) => {
      bodies.push(await request.json())
      const reply = replies[Math.min(bodies.length, replies.length) - 1]
      if (reply === 'network-error') return HttpResponse.error()
      if (typeof reply === 'number') return new HttpResponse(null, { status: reply })
      return HttpResponse.json(reply.body, { status: reply.status })
    }),
  )
  return bodies
}

describe('requestSafenetCheck', () => {
  const params = {
    chainId: '42161',
    safeAddress: '0x61af6845aA50eaC727422Bc458d9041C7b336E0A',
    safeTxHash: '0x' + '1'.repeat(64),
  }

  beforeEach(() => jest.useFakeTimers())
  afterEach(() => jest.useRealTimers())

  const request = async () => {
    const pending = requestSafenetCheck(params)
    await jest.runAllTimersAsync()
    return pending
  }

  const expectRejection = async (message: string) => {
    const assertion = expect(requestSafenetCheck(params)).rejects.toThrow(message)
    await jest.runAllTimersAsync()
    await assertion
  }

  it('posts the webhook-shaped payload to /propose', async () => {
    const bodies = serveReplies(202)
    await request()
    expect(bodies).toEqual([
      {
        type: 'PENDING_MULTISIG_TRANSACTION',
        chainId: params.chainId,
        address: params.safeAddress,
        safeTxHash: params.safeTxHash,
      },
    ])
  })

  it('retries a transient failure and then succeeds', async () => {
    const bodies = serveReplies('network-error', 503, 202)
    await request()
    expect(bodies).toHaveLength(3)
  })

  it('gives up after the retry budget', async () => {
    const bodies = serveReplies(500)
    await expectRejection('500')
    expect(bodies).toHaveLength(4)
  })

  it('does not retry a final refusal', async () => {
    const bodies = serveReplies(403)
    await expectRejection('403')
    expect(bodies).toHaveLength(1)
  })

  it('does not retry a 402', async () => {
    const bodies = serveReplies({ status: 402, body: { success: false, message: 'sponsor is short' } })
    await expectRejection('402')
    expect(bodies).toHaveLength(1)
  })
})

describe('toRequestFailure', () => {
  it('classifies only a 402 as underfunded', () => {
    expect(toRequestFailure(new SafenetProxyError(402))).toBe('underfunded')
    expect(toRequestFailure(new SafenetProxyError(500))).toBe('failed')
    expect(toRequestFailure(new Error('offline'))).toBe('failed')
  })
})
