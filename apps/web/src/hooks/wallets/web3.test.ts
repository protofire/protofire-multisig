import { getUserNonce } from './web3'
import { getWeb3ReadOnly } from './web3ReadOnly'

jest.mock('./web3ReadOnly', () => ({
  getWeb3ReadOnly: jest.fn(),
  setWeb3: jest.fn(),
  useWeb3: jest.fn(),
  setWeb3ReadOnly: jest.fn(),
  useWeb3ReadOnly: jest.fn(),
}))

const mockGetWeb3ReadOnly = jest.mocked(getWeb3ReadOnly)

describe('getUserNonce', () => {
  const getTransactionCount = jest.fn()
  const getNetwork = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    mockGetWeb3ReadOnly.mockReturnValue({ getTransactionCount, getNetwork } as never)
  })

  it('uses zero when a known Tron provider has no nonce endpoint', async () => {
    const error = new Error('eth_getTransactionCount is not supported')
    getTransactionCount.mockRejectedValue(error)
    getNetwork.mockResolvedValue({ chainId: 728126428n })

    await expect(getUserNonce('0x123')).resolves.toBe(0)
  })

  it('preserves RPC errors for EVM providers', async () => {
    const error = new Error('RPC unavailable')
    getTransactionCount.mockRejectedValue(error)
    getNetwork.mockResolvedValue({ chainId: 1n })

    await expect(getUserNonce('0x123')).rejects.toBe(error)
  })

  it('preserves the nonce error when the provider cannot identify its network', async () => {
    const error = new Error('RPC unavailable')
    getTransactionCount.mockRejectedValue(error)
    getNetwork.mockRejectedValue(new Error('network unavailable'))

    await expect(getUserNonce('0x123')).rejects.toBe(error)
  })
})
