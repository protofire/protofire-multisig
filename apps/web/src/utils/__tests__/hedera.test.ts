import {
  HederaNetwork,
  getHederaAccountId,
  getHederaEvmAddress,
  getHederaContractId,
  getHederaEvmTransactionHash,
  isHederaAccountId,
  hederaEntityIdToEvmAddress,
  getHederaTokenMetadata,
  getHederaAssociatedTokens,
  isHederaTokenAssociated,
  getHederaTokenExplorerLink,
  getTokenExplorerLink,
  getHederaTransactionExplorerLink,
  formatHederaTransactionId,
  getHederaNetwork,
  isHederaChain,
  isHederaLongZeroAddress,
} from '../hedera'
import { chainBuilder } from '@/tests/builders/chains'
import { FEATURES } from '@safe-global/utils/utils/chains'

const originalGlobalFetch = global.fetch

describe('getHederaNetwork', () => {
  it('should map a Hedera chain to its network by isTestnet', () => {
    const hedera = chainBuilder().with({ features: [FEATURES.HEDERA] })
    expect(getHederaNetwork(hedera.with({ isTestnet: false }).build())).toBe(HederaNetwork.MAINNET)
    expect(getHederaNetwork(hedera.with({ isTestnet: true }).build())).toBe(HederaNetwork.TESTNET)
  })

  it('should return undefined for a non-Hedera or missing chain', () => {
    const evmChain = chainBuilder().with({ features: [] }).build()
    expect(getHederaNetwork(evmChain)).toBeUndefined()
    expect(getHederaNetwork(undefined)).toBeUndefined()
    expect(isHederaChain(evmChain)).toBe(false)
  })
})

describe('mirror node base URL', () => {
  const originalEnv = process.env

  afterEach(() => {
    process.env = originalEnv
    global.fetch = originalGlobalFetch
  })

  it('should use the mirror node URL from the environment when set', async () => {
    process.env = { ...originalEnv, NEXT_PUBLIC_HEDERA_MIRROR_NODE_TESTNET_URL: 'https://mirror.example.com' }
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ contract_id: '0.0.5' }) })

    await jest.isolateModulesAsync(async () => {
      const isolated = await import('../hedera')
      await isolated.getHederaContractId(isolated.HederaNetwork.TESTNET, '0xenv')
    })

    expect(global.fetch).toHaveBeenCalledWith('https://mirror.example.com/api/v1/contracts/0xenv', expect.anything())
  })
})

describe('hedera mirror-node helpers', () => {
  afterEach(() => {
    global.fetch = originalGlobalFetch
    jest.clearAllMocks()
  })

  describe('getHederaEvmAddress', () => {
    it('should resolve the evm_address from the testnet mirror node', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ evm_address: '0x0000000000000000000000000000000000004d' }),
      })

      const address = await getHederaEvmAddress(HederaNetwork.TESTNET, '0.0.77')

      expect(global.fetch).toHaveBeenCalledWith(
        'https://testnet.mirrornode.hedera.com/api/v1/accounts/0.0.77',
        expect.anything(),
      )
      expect(address).toBe('0x0000000000000000000000000000000000004d')
    })

    it('should resolve the evm_address from the mainnet mirror node', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ evm_address: '0xd89cfd973d251ff04d345a4962afb5efa6382036' }),
      })

      const address = await getHederaEvmAddress(HederaNetwork.MAINNET, '0.0.10814740')

      expect(global.fetch).toHaveBeenCalledWith(
        'https://mainnet-public.mirrornode.hedera.com/api/v1/accounts/0.0.10814740',
        expect.anything(),
      )
      expect(address).toBe('0xd89cfd973d251ff04d345a4962afb5efa6382036')
    })

    it('should cache the result for the same network/account and not re-fetch', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ evm_address: '0x0000000000000000000000000000000000004d' }),
      })

      await getHederaEvmAddress(HederaNetwork.TESTNET, '0.0.999')
      await getHederaEvmAddress(HederaNetwork.TESTNET, '0.0.999')

      expect(global.fetch).toHaveBeenCalledTimes(1)
    })

    it('should throw when the mirror node responds with an error status', async () => {
      global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 404 })

      await expect(getHederaEvmAddress(HederaNetwork.TESTNET, '0.0.notfound')).rejects.toThrow(
        'mirror node returned 404',
      )
    })

    it('should throw when the account has no evm_address', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      })

      await expect(getHederaEvmAddress(HederaNetwork.TESTNET, '0.0.no-alias')).rejects.toThrow('has no evm_address')
    })
  })

  describe('getHederaAccountId', () => {
    it('should resolve the native account id from an evm address via the mirror node', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ account: '0.0.10814740' }),
      })

      const accountId = await getHederaAccountId(HederaNetwork.MAINNET, '0xd89cfd973d251ff04d345a4962afb5efa6382036')

      expect(global.fetch).toHaveBeenCalledWith(
        'https://mainnet-public.mirrornode.hedera.com/api/v1/accounts/0xd89cfd973d251ff04d345a4962afb5efa6382036',
        expect.anything(),
      )
      expect(accountId).toBe('0.0.10814740')
    })

    it('should cache the result for the same network/address and not re-fetch', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ account: '0.0.111' }),
      })

      await getHederaAccountId(HederaNetwork.TESTNET, '0xabc')
      await getHederaAccountId(HederaNetwork.TESTNET, '0xabc')

      expect(global.fetch).toHaveBeenCalledTimes(1)
    })

    it('should throw when the mirror node has no account for the address', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      })

      await expect(getHederaAccountId(HederaNetwork.TESTNET, '0xunknown')).rejects.toThrow('No Hedera account found')
    })
  })

  describe('getHederaContractId', () => {
    it('should resolve the native contract id from an evm address via the mirror node', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ contract_id: '0.0.8923237' }),
      })

      const contractId = await getHederaContractId(HederaNetwork.MAINNET, '0xa6b71e26c5e0845f74c812102ca7114b6a896ab2')

      expect(global.fetch).toHaveBeenCalledWith(
        'https://mainnet-public.mirrornode.hedera.com/api/v1/contracts/0xa6b71e26c5e0845f74c812102ca7114b6a896ab2',
        expect.anything(),
      )
      expect(contractId).toBe('0.0.8923237')
    })

    it('should cache the result for the same network/address and not re-fetch', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ contract_id: '0.0.222' }),
      })

      await getHederaContractId(HederaNetwork.TESTNET, '0xdef')
      await getHederaContractId(HederaNetwork.TESTNET, '0xdef')

      expect(global.fetch).toHaveBeenCalledTimes(1)
    })

    it('should throw when the mirror node has no contract for the address', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      })

      await expect(getHederaContractId(HederaNetwork.TESTNET, '0xunknown')).rejects.toThrow('No Hedera contract found')
    })
  })

  describe('getHederaEvmTransactionHash', () => {
    let setTimeoutSpy: jest.SpyInstance

    beforeEach(() => {
      // Skip the real polling delay — resolve setTimeout callbacks immediately.
      setTimeoutSpy = jest.spyOn(global, 'setTimeout').mockImplementation(((fn: () => void) => {
        fn()
        return 0 as unknown as NodeJS.Timeout
      }) as typeof setTimeout)
    })

    afterEach(() => {
      setTimeoutSpy.mockRestore()
    })

    it('should convert the SDK transaction id format and resolve the real EVM hash', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ hash: '0xdc45fc2a9f8543d50199572a05e149feadd409d142a1cfeba121793d8d3d7dc7' }),
      })

      const hash = await getHederaEvmTransactionHash(HederaNetwork.MAINNET, '0.0.10418723@1789395613.539062406')

      expect(global.fetch).toHaveBeenCalledWith(
        'https://mainnet-public.mirrornode.hedera.com/api/v1/contracts/results/0.0.10418723-1789395613-539062406',
        expect.anything(),
      )
      expect(hash).toBe('0xdc45fc2a9f8543d50199572a05e149feadd409d142a1cfeba121793d8d3d7dc7')
    })

    it('should retry until the transaction is indexed by the mirror node', async () => {
      global.fetch = jest
        .fn()
        .mockResolvedValueOnce({ ok: false, status: 404 })
        .mockResolvedValueOnce({ ok: false, status: 404 })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ hash: '0xabc' }) })

      const hash = await getHederaEvmTransactionHash(HederaNetwork.TESTNET, '0.0.1@1700000000.000000000')

      expect(global.fetch).toHaveBeenCalledTimes(3)
      expect(hash).toBe('0xabc')
    })

    it('should throw after exhausting all retry attempts', async () => {
      global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 404 })

      await expect(getHederaEvmTransactionHash(HederaNetwork.TESTNET, '0.0.1@1700000000.000000000')).rejects.toThrow(
        'was submitted but its EVM-equivalent hash could not be confirmed',
      )
    })
  })

  describe('isHederaAccountId', () => {
    it('should recognize a native entity id', () => {
      expect(isHederaAccountId('0.0.10814740')).toBe(true)
      expect(isHederaAccountId('  0.0.1  ')).toBe(true)
    })

    it('should reject anything else', () => {
      expect(isHederaAccountId('0xd89cfd973d251ff04d345a4962afb5efa6382036')).toBe(false)
      expect(isHederaAccountId('vitalik.eth')).toBe(false)
      expect(isHederaAccountId('0.0.')).toBe(false)
      expect(isHederaAccountId('')).toBe(false)
    })
  })

  describe('hederaEntityIdToEvmAddress', () => {
    it('should encode the entity number as a long-zero 20-byte address', () => {
      // Matches the token param observed live in an associateToken(account, token) call for
      // token 0.0.731861 (0xb2ad5 in hex).
      expect(hederaEntityIdToEvmAddress('0.0.731861')).toBe('0x00000000000000000000000000000000000b2ad5')
      expect(hederaEntityIdToEvmAddress('0.0.77')).toBe('0x000000000000000000000000000000000000004d')
    })
  })

  describe('getHederaTokenMetadata', () => {
    it('should resolve token metadata and compute its long-zero evm address', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            token_id: '0.0.731861',
            name: 'SAUCE',
            symbol: 'SAUCE',
            decimals: '6',
            type: 'FUNGIBLE_COMMON',
            deleted: false,
          }),
      })

      const metadata = await getHederaTokenMetadata(HederaNetwork.MAINNET, '0.0.731861')

      expect(global.fetch).toHaveBeenCalledWith(
        'https://mainnet-public.mirrornode.hedera.com/api/v1/tokens/0.0.731861',
        expect.anything(),
      )
      expect(metadata).toEqual({
        tokenId: '0.0.731861',
        evmAddress: '0x00000000000000000000000000000000000b2ad5',
        name: 'SAUCE',
        symbol: 'SAUCE',
        decimals: 6,
        type: 'FUNGIBLE_COMMON',
        deleted: false,
      })
    })

    it('should accept a 0x address lookup too', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            token_id: '0.0.456858',
            name: 'USD Coin',
            symbol: 'USDC',
            decimals: '6',
            type: 'FUNGIBLE_COMMON',
          }),
      })

      const evmAddress = '0x0000000000000000000000000000000006f8da'
      await getHederaTokenMetadata(HederaNetwork.MAINNET, evmAddress)

      expect(global.fetch).toHaveBeenCalledWith(
        `https://mainnet-public.mirrornode.hedera.com/api/v1/tokens/${evmAddress}`,
        expect.anything(),
      )
    })

    it('should throw when the mirror node responds with an error status', async () => {
      global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 404 })

      await expect(getHederaTokenMetadata(HederaNetwork.TESTNET, '0.0.notfound')).rejects.toThrow(
        'mirror node returned 404',
      )
    })

    it('should throw when no token is found', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      })

      await expect(getHederaTokenMetadata(HederaNetwork.TESTNET, '0.0.unknown')).rejects.toThrow(
        'No Hedera token found',
      )
    })
  })

  describe('getHederaAssociatedTokens', () => {
    const MAINNET = 'https://mainnet-public.mirrornode.hedera.com'
    const safeAddress = '0x3DDDCE646712500aB55E1b2d6E61de4C409f50EF'

    // Answers each mirror node request by its exact URL, so call order between the parallel
    // relationships/names requests doesn't matter
    const mockMirrorNode = (responses: Record<string, unknown>) => {
      global.fetch = jest.fn((url: string) =>
        Promise.resolve(
          url in responses
            ? { ok: true, json: () => Promise.resolve(responses[url]) }
            : { ok: false, status: 404, json: () => Promise.resolve({}) },
        ),
      ) as unknown as typeof fetch
    }

    it('should list associated tokens with their names, symbols and long-zero evm addresses', async () => {
      mockMirrorNode({
        [`${MAINNET}/api/v1/accounts/${safeAddress}`]: { account: '0.0.10822517' },
        [`${MAINNET}/api/v1/accounts/0.0.10822517/tokens?limit=100`]: {
          tokens: [
            {
              automatic_association: false,
              balance: 5000000,
              created_timestamp: '1789555147.748551105',
              decimals: 6,
              token_id: '0.0.731861',
              freeze_status: 'NOT_APPLICABLE',
              kyc_status: 'NOT_APPLICABLE',
            },
          ],
          links: { next: null },
        },
        [`${MAINNET}/api/v1/tokens?account.id=0.0.10822517&limit=100`]: {
          tokens: [{ token_id: '0.0.731861', name: 'SAUCE', symbol: 'SAUCE', decimals: 6 }],
          links: { next: null },
        },
      })

      const result = await getHederaAssociatedTokens(HederaNetwork.MAINNET, safeAddress)

      expect(result.truncated).toBe(false)
      expect(result.tokens).toEqual([
        {
          tokenId: '0.0.731861',
          evmAddress: '0x00000000000000000000000000000000000b2ad5',
          name: 'SAUCE',
          symbol: 'SAUCE',
          balance: 5000000,
          decimals: 6,
          freezeStatus: 'NOT_APPLICABLE',
          createdAt: new Date(1789555147 * 1000),
        },
      ])
    })

    it('should follow links.next pagination', async () => {
      const token = (id: string) => ({
        balance: 1,
        decimals: 2,
        token_id: id,
        freeze_status: 'NOT_APPLICABLE',
        created_timestamp: '1700000000.0',
      })
      mockMirrorNode({
        [`https://testnet.mirrornode.hedera.com/api/v1/accounts/0.0.2/tokens?limit=100`]: {
          tokens: [token('0.0.1')],
          links: { next: '/api/v1/accounts/0.0.2/tokens?limit=100&token.id=gt:0.0.1' },
        },
        [`https://testnet.mirrornode.hedera.com/api/v1/accounts/0.0.2/tokens?limit=100&token.id=gt:0.0.1`]: {
          tokens: [token('0.0.3')],
          links: { next: null },
        },
        [`https://testnet.mirrornode.hedera.com/api/v1/tokens?account.id=0.0.2&limit=100`]: {
          tokens: [],
          links: { next: null },
        },
      })

      const result = await getHederaAssociatedTokens(HederaNetwork.TESTNET, '0.0.2')

      expect(result.truncated).toBe(false)
      expect(result.tokens.map((t) => t.tokenId)).toEqual(['0.0.1', '0.0.3'])
      // A token missing from the names listing still renders, just without a name
      expect(result.tokens[0]).toMatchObject({ name: '', symbol: '' })
    })

    it('should throw when the mirror node responds with an error status', async () => {
      mockMirrorNode({})

      await expect(getHederaAssociatedTokens(HederaNetwork.TESTNET, '0.0.404')).rejects.toThrow(
        'failed with status 404',
      )
    })
  })

  describe('isHederaTokenAssociated', () => {
    it('should query only the given token by its native id and report whether it is associated', async () => {
      global.fetch = jest
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ tokens: [{ token_id: '0.0.731861' }], links: { next: null } }),
        })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ tokens: [], links: { next: null } }) })

      await expect(isHederaTokenAssociated(HederaNetwork.MAINNET, '0.0.10822517', '0.0.731861')).resolves.toBe(true)
      await expect(isHederaTokenAssociated(HederaNetwork.MAINNET, '0.0.10822517', '0.0.456858-abcde')).resolves.toBe(
        false,
      )

      expect(global.fetch).toHaveBeenNthCalledWith(
        1,
        'https://mainnet-public.mirrornode.hedera.com/api/v1/accounts/0.0.10822517/tokens?token.id=0.0.731861',
        expect.anything(),
      )
      // The checksum suffix is stripped — the token.id filter rejects it as an invalid parameter
      expect(global.fetch).toHaveBeenNthCalledWith(
        2,
        'https://mainnet-public.mirrornode.hedera.com/api/v1/accounts/0.0.10822517/tokens?token.id=0.0.456858',
        expect.anything(),
      )
    })
  })

  describe('getHederaTokenExplorerLink', () => {
    it('should build a HashScan token (not account) link', () => {
      expect(getHederaTokenExplorerLink(HederaNetwork.MAINNET, '0x00000000000000000000000000000000000b2ad5')).toBe(
        'https://hashscan.io/mainnet/token/0x00000000000000000000000000000000000b2ad5',
      )
      expect(getHederaTokenExplorerLink(HederaNetwork.TESTNET, '0x123')).toBe('https://hashscan.io/testnet/token/0x123')
    })
  })

  describe('getTokenExplorerLink', () => {
    const blockExplorerUriTemplate = {
      address: 'https://hashscan.io/mainnet/account/{{address}}',
      txHash: 'https://hashscan.io/mainnet/transaction/{{txHash}}',
      api: '',
    }
    const tokenAddress = '0x00000000000000000000000000000000000b2ad5'

    it("should link a Hedera token to HashScan's /token/ page, not the chain config's /account/ template", () => {
      const chain = chainBuilder()
        .with({ features: [FEATURES.HEDERA], isTestnet: false, blockExplorerUriTemplate })
        .build()
      expect(getTokenExplorerLink(chain, tokenAddress)).toEqual({
        href: `https://hashscan.io/mainnet/token/${tokenAddress}`,
        title: 'View on hashscan.io',
      })
    })

    it('should use the generic block explorer link on other chains', () => {
      const chain = chainBuilder()
        .with({
          features: [],
          blockExplorerUriTemplate: {
            ...blockExplorerUriTemplate,
            address: 'https://etherscan.io/address/{{address}}',
          },
        })
        .build()
      expect(getTokenExplorerLink(chain, tokenAddress)?.href).toBe(`https://etherscan.io/address/${tokenAddress}`)
    })
  })

  describe('getHederaTransactionExplorerLink', () => {
    it('should build a HashScan transaction link from a mirror node transaction id', () => {
      expect(getHederaTransactionExplorerLink(HederaNetwork.MAINNET, '0.0.10822511-1787674970-069053976')).toBe(
        'https://hashscan.io/mainnet/transaction/0.0.10822511-1787674970-069053976',
      )
      expect(getHederaTransactionExplorerLink(HederaNetwork.TESTNET, '0.0.1-1-2')).toBe(
        'https://hashscan.io/testnet/transaction/0.0.1-1-2',
      )
    })
  })

  describe('formatHederaTransactionId', () => {
    it('should format a mirror node transaction id the way HashPack/HashScan display it', () => {
      expect(formatHederaTransactionId('0.0.10822511-1787674970-069053976')).toBe('0.0.10822511@1787674970.069053976')
    })

    it('should return any other value unchanged', () => {
      expect(formatHederaTransactionId('0.0.10822511@1787674970.069053976')).toBe('0.0.10822511@1787674970.069053976')
      expect(formatHederaTransactionId('0x1234')).toBe('0x1234')
    })
  })
})

describe('isHederaLongZeroAddress', () => {
  it('detects the long-zero address of a native Hedera account', () => {
    expect(isHederaLongZeroAddress('0x0000000000000000000000000000000000a5236f')).toBe(true)
    expect(isHederaLongZeroAddress(hederaEntityIdToEvmAddress('0.0.10822511'))).toBe(true)
  })

  it('does not flag a key-derived EVM address', () => {
    expect(isHederaLongZeroAddress('0x121618508481FCedEb2abc9b00dAe2eCFc5b9173')).toBe(false)
    expect(isHederaLongZeroAddress('0x00000000000000000000000100000000000a5236')).toBe(false)
  })

  it('does not flag invalid input', () => {
    expect(isHederaLongZeroAddress('0.0.10822511')).toBe(false)
    expect(isHederaLongZeroAddress('')).toBe(false)
  })
})
