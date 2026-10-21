import {
  computeDescriptorHash,
  resolveCalldataDescriptor,
  type ChainClient,
  type Descriptor,
  type DescriptorResolver,
  type OffchainAttestation,
} from '@ethereum-sourcify/clear-signing'
import { faker } from '@faker-js/faker'
import { id, Signature, Wallet, type BaseWallet } from 'ethers'
import { CYFRIN_ATTESTER } from '../testHelpers'
import {
  resolveAttestation,
  type ClearSigningAttestationResult,
  type ClearSigningAttestationStatus,
  type ResolveAttestationOptions,
} from './attestation'
import wethAttestation from './__fixtures__/calldata-weth.eip155-1-0x3846c3A30E62075Fa916216b35EF04B8F53931f6.json'
import wethDescriptorJson from './__fixtures__/calldata-weth.json'

const WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'
const DESCRIPTOR_PATH = 'registry/weth/calldata-weth.json'
const NOT_REVOKED = `0x${'0'.repeat(64)}`
const REVOKED_AT = `0x${'0'.repeat(56)}6a2f1d58`
const wethDescriptor = wethDescriptorJson as Descriptor

type ChainResult = string | Error
type ResolveOverrides = Partial<Omit<ResolveAttestationOptions, 'resolve'>>

const createWallet = (): BaseWallet => new Wallet(id(faker.string.uuid()))

const signAttestation = async (
  wallet: BaseWallet,
  descriptor: Descriptor,
  expirationTime = '0',
): Promise<OffchainAttestation> => {
  const { uid: _, domain, types, message: template, ...sig } = wethAttestation.sig
  const message = {
    ...template,
    data: computeDescriptorHash(descriptor),
    salt: faker.string.hexadecimal({ length: 64, casing: 'lower' }),
    expirationTime,
  }
  const { v, r, s } = Signature.from(await wallet.signTypedData(domain, types, message))
  return { sig: { ...sig, domain, types, message, signature: { v, r, s } }, signer: wallet.address }
}

const tamper = (attestation: OffchainAttestation): OffchainAttestation => {
  const r = attestation.sig?.signature?.r ?? ''
  return {
    ...attestation,
    sig: { ...attestation.sig, signature: { ...attestation.sig?.signature, r: `${r.slice(0, -2)}00` } },
  }
}

const createResolver = (
  attestations: Record<string, OffchainAttestation | null>,
  descriptors: Record<string, Descriptor> = { [DESCRIPTOR_PATH]: wethDescriptor },
): DescriptorResolver => ({
  index: { calldataIndex: { [`eip155:1:${WETH.toLowerCase()}`]: DESCRIPTOR_PATH }, typedDataIndex: {} },
  fetchDescriptor: jest.fn(async (path: string) => {
    const descriptor = descriptors[path]
    if (!descriptor) throw new Error(`HTTP 404 fetching ${path}`)
    return descriptor
  }),
  fetchAttestation: jest.fn(async (_: string, attester: string) => attestations[attester] ?? null),
})

const settle = (result: ChainResult): Promise<string> =>
  result instanceof Error ? Promise.reject(result) : Promise.resolve(result)

const createChainClient = (results: ChainResult[]): ChainClient => {
  const call = jest.fn<Promise<string>, [number, { to: string; data: string }]>()
  results.forEach((result) => call.mockImplementationOnce(() => settle(result)))
  return { call }
}

const createChainClientByAttester = (results: Record<string, ChainResult>): ChainClient => ({
  call: jest.fn(async (_: number, { data }: { to: string; data: string }) => {
    const attester = Object.keys(results).find((address) => data.toLowerCase().includes(address.slice(2).toLowerCase()))
    return attester ? settle(results[attester]) : Promise.reject(new Error(`unexpected call ${data}`))
  }),
})

const resolve = (
  resolver: DescriptorResolver,
  chainClient: ChainClient | undefined,
  overrides: ResolveOverrides = {},
): Promise<ClearSigningAttestationResult> =>
  resolveAttestation({
    resolver,
    chainClient,
    trustedAttesters: [CYFRIN_ATTESTER],
    resolve: (options, client) => resolveCalldataDescriptor(1, WETH, options, client),
    ...overrides,
  })

describe('resolveAttestation', () => {
  it('returns an empty result when fetching the descriptor fails', async () => {
    const onFailure = jest.fn()

    const result = await resolve(createResolver({}, {}), createChainClient([]), { onFailure })

    expect(result).toEqual({})
    expect(onFailure).not.toHaveBeenCalled()
  })

  it('reports an attested descriptor with the attester address and dates', async () => {
    const wallet = createWallet()
    const expirationTime = String(Math.floor(Date.now() / 1000) + 365 * 24 * 3600)
    const resolver = createResolver({ [wallet.address]: await signAttestation(wallet, wethDescriptor, expirationTime) })

    const result = await resolve(resolver, createChainClient([NOT_REVOKED]), { trustedAttesters: [wallet.address] })

    expect(result).toEqual({
      descriptorPath: DESCRIPTOR_PATH,
      attestation: {
        status: 'attested',
        attester: {
          address: wallet.address,
          attestedAt: Number(wethAttestation.sig.message.time),
          expiresAt: Number(expirationTime),
          attestationPath: `registry/weth/sigs/calldata-weth.eip155-1-${wallet.address}.json`,
        },
      },
    })
  })

  it.each<[string, OffchainAttestation | null, ChainResult[], ClearSigningAttestationStatus]>([
    ['no trusted attester published an attestation', null, [], 'unattested'],
    ['the attestation signature does not verify', tamper(wethAttestation), [], 'unattested'],
    ['the attestation was revoked on EAS', wethAttestation, [REVOKED_AT], 'revoked'],
    ['the revocation state cannot be read', wethAttestation, [new Error('RPC unavailable')], 'unattested'],
    ['the revocation call returns malformed data', wethAttestation, ['0x'], 'unattested'],
  ])('reports %s', async (_, attestation, chainResults, status) => {
    const resolver = createResolver({ [CYFRIN_ATTESTER]: attestation })

    const result = await resolve(resolver, createChainClient(chainResults))

    expect(result).toEqual({ descriptorPath: DESCRIPTOR_PATH, attestation: { status } })
  })

  it('reports unattested when the descriptor changed after it was attested', async () => {
    const edited = { ...wethDescriptor, metadata: { ...wethDescriptor.metadata, owner: 'Edited after review' } }
    const resolver = createResolver({ [CYFRIN_ATTESTER]: wethAttestation }, { [DESCRIPTOR_PATH]: edited })
    const chainClient = createChainClient([])

    const result = await resolve(resolver, chainClient)

    expect(result).toEqual({ descriptorPath: DESCRIPTOR_PATH, attestation: { status: 'unattested' } })
    expect(chainClient.call).not.toHaveBeenCalled()
  })

  it('reports unattested when the attestation passed its expiration time', async () => {
    const wallet = createWallet()
    const expirationTime = String(Math.floor(Date.now() / 1000) - 1)
    const resolver = createResolver({ [wallet.address]: await signAttestation(wallet, wethDescriptor, expirationTime) })
    const chainClient = createChainClient([])

    const result = await resolve(resolver, chainClient, { trustedAttesters: [wallet.address] })

    expect(result).toEqual({ descriptorPath: DESCRIPTOR_PATH, attestation: { status: 'unattested' } })
    expect(chainClient.call).not.toHaveBeenCalled()
  })

  it('reports unattested when no chain client is available', async () => {
    const result = await resolve(createResolver({ [CYFRIN_ATTESTER]: wethAttestation }), undefined)

    expect(result).toEqual({ descriptorPath: DESCRIPTOR_PATH, attestation: { status: 'unattested' } })
  })

  it('reports unattested when no trusted attesters are configured', async () => {
    const resolver = createResolver({ [CYFRIN_ATTESTER]: wethAttestation })

    const result = await resolve(resolver, createChainClient([]), { trustedAttesters: [] })

    expect(result).toEqual({ descriptorPath: DESCRIPTOR_PATH, attestation: { status: 'unattested' } })
    expect(resolver.fetchAttestation).not.toHaveBeenCalled()
  })

  describe('with several trusted attesters', () => {
    const createTwoAttesterResolver = async (wallet: BaseWallet, cyfrin: OffchainAttestation = wethAttestation) =>
      createResolver({ [CYFRIN_ATTESTER]: cyfrin, [wallet.address]: await signAttestation(wallet, wethDescriptor) })

    it('credits the attester whose revocation check passed, whatever order the chain answers in', async () => {
      const wallet = createWallet()
      const resolver = await createTwoAttesterResolver(wallet)
      const chainClient = createChainClientByAttester({ [CYFRIN_ATTESTER]: REVOKED_AT, [wallet.address]: NOT_REVOKED })

      const result = await resolve(resolver, chainClient, { trustedAttesters: [CYFRIN_ATTESTER, wallet.address] })

      expect(result).toMatchObject({ attestation: { status: 'attested', attester: { address: wallet.address } } })
    })

    it('credits the first configured attester when more than one passes', async () => {
      const wallet = createWallet()
      const resolver = await createTwoAttesterResolver(wallet)
      const chainClient = createChainClientByAttester({ [CYFRIN_ATTESTER]: NOT_REVOKED, [wallet.address]: NOT_REVOKED })

      const result = await resolve(resolver, chainClient, { trustedAttesters: [wallet.address, CYFRIN_ATTESTER] })

      expect(result).toMatchObject({ attestation: { status: 'attested', attester: { address: wallet.address } } })
    })

    it('checks every attester once and does not credit one that was never checked', async () => {
      const wallet = createWallet()
      const resolver = await createTwoAttesterResolver(wallet)
      const chainClient = createChainClientByAttester({ [CYFRIN_ATTESTER]: NOT_REVOKED, [wallet.address]: NOT_REVOKED })

      await resolve(resolver, chainClient, { trustedAttesters: [CYFRIN_ATTESTER, wallet.address] })

      expect(resolver.fetchAttestation).toHaveBeenCalledTimes(2)
      expect(resolver.fetchAttestation).toHaveBeenCalledWith(DESCRIPTOR_PATH, CYFRIN_ATTESTER)
      expect(resolver.fetchAttestation).toHaveBeenCalledWith(DESCRIPTOR_PATH, wallet.address)
      expect(chainClient.call).toHaveBeenCalledTimes(2)
    })

    it('reports revoked when another check cannot read the revocation state', async () => {
      const wallet = createWallet()
      const resolver = await createTwoAttesterResolver(wallet)
      const chainClient = createChainClientByAttester({
        [CYFRIN_ATTESTER]: REVOKED_AT,
        [wallet.address]: new Error('RPC unavailable'),
      })

      const result = await resolve(resolver, chainClient, { trustedAttesters: [CYFRIN_ATTESTER, wallet.address] })

      expect(result).toEqual({ descriptorPath: DESCRIPTOR_PATH, attestation: { status: 'revoked' } })
    })

    it('reports revoked when one of several attestation fetches fails and another attestation is revoked', async () => {
      const silent = createWallet()
      const unreachable = createWallet()
      const fetchError = new Error('HTTP 503 fetching attestation')
      const base = createResolver({ [CYFRIN_ATTESTER]: wethAttestation })
      const resolver: DescriptorResolver = {
        ...base,
        fetchAttestation: jest.fn(async (path: string, attester: string) =>
          attester === unreachable.address ? Promise.reject(fetchError) : base.fetchAttestation!(path, attester),
        ),
      }
      const chainClient = createChainClientByAttester({ [CYFRIN_ATTESTER]: REVOKED_AT })
      const onFailure = jest.fn()

      const result = await resolve(resolver, chainClient, {
        trustedAttesters: [silent.address, unreachable.address, CYFRIN_ATTESTER],
        onFailure,
      })

      expect(result).toEqual({ descriptorPath: DESCRIPTOR_PATH, attestation: { status: 'revoked' } })
      expect(resolver.fetchAttestation).toHaveBeenCalledTimes(3)
      expect(chainClient.call).toHaveBeenCalledTimes(1)
      expect(onFailure).not.toHaveBeenCalled()
    })

    it('reports revoked over unattested when another trusted attester published nothing', async () => {
      const silent = createWallet()
      const resolver = createResolver({ [CYFRIN_ATTESTER]: wethAttestation })

      const result = await resolve(resolver, createChainClient([REVOKED_AT]), {
        trustedAttesters: [silent.address, CYFRIN_ATTESTER],
      })

      expect(result).toEqual({ descriptorPath: DESCRIPTOR_PATH, attestation: { status: 'revoked' } })
    })

    it('reports unattested when the only published attestation is tampered', async () => {
      const wallet = createWallet()
      const resolver = createResolver({ [CYFRIN_ATTESTER]: tamper(wethAttestation) })

      const result = await resolve(resolver, createChainClient([]), {
        trustedAttesters: [wallet.address, CYFRIN_ATTESTER],
      })

      expect(result).toEqual({ descriptorPath: DESCRIPTOR_PATH, attestation: { status: 'unattested' } })
    })
  })

  it('records the top-level descriptor path when the descriptor includes another', async () => {
    const includedPath = 'registry/common/calldata-base.json'
    const resolver = createResolver(
      {},
      {
        [DESCRIPTOR_PATH]: { ...wethDescriptor, includes: '../common/calldata-base.json' },
        [includedPath]: { metadata: { owner: 'Common' } },
      },
    )

    const result = await resolve(resolver, createChainClient([]))

    expect(result).toEqual({ descriptorPath: DESCRIPTOR_PATH, attestation: { status: 'unattested' } })
    expect(resolver.fetchDescriptor).toHaveBeenCalledWith(includedPath)
    expect(resolver.fetchAttestation).toHaveBeenCalledWith(DESCRIPTOR_PATH, CYFRIN_ATTESTER)
  })

  it('leaves the status undefined for warnings unrelated to attestations', async () => {
    const resolver = createResolver({}, { [DESCRIPTOR_PATH]: { ...wethDescriptor, includes: './calldata-weth.json' } })

    const result = await resolve(resolver, createChainClient([]))

    expect(result).toEqual({ descriptorPath: DESCRIPTOR_PATH, attestation: undefined })
  })

  describe('failure reporting', () => {
    it('reports a revocation call that returns malformed data', async () => {
      const onFailure = jest.fn()
      const resolver = createResolver({ [CYFRIN_ATTESTER]: wethAttestation })

      await resolve(resolver, createChainClient(['0x']), { onFailure })

      expect(onFailure).toHaveBeenCalledTimes(1)
      expect(onFailure).toHaveBeenCalledWith(expect.any(Error))
    })

    it('does not report a failing revocation call', async () => {
      const onFailure = jest.fn()
      const resolver = createResolver({ [CYFRIN_ATTESTER]: wethAttestation })

      const result = await resolve(resolver, createChainClient([new Error('RPC unavailable')]), { onFailure })

      expect(result).toEqual({ descriptorPath: DESCRIPTOR_PATH, attestation: { status: 'unattested' } })
      expect(onFailure).not.toHaveBeenCalled()
    })

    it('does not report a failing attestation fetch', async () => {
      const onFailure = jest.fn()
      const resolver: DescriptorResolver = {
        ...createResolver({}),
        fetchAttestation: jest
          .fn<Promise<OffchainAttestation | null>, [string, string]>()
          .mockRejectedValue(new Error('HTTP 503 fetching attestation')),
      }

      const result = await resolve(resolver, createChainClient([]), { onFailure })

      expect(result).toEqual({ descriptorPath: DESCRIPTOR_PATH, attestation: { status: 'unattested' } })
      expect(onFailure).not.toHaveBeenCalled()
    })

    it('does not report a failing included descriptor fetch', async () => {
      const onFailure = jest.fn()
      const resolver = createResolver(
        {},
        { [DESCRIPTOR_PATH]: { ...wethDescriptor, includes: '../common/missing.json' } },
      )

      const result = await resolve(resolver, createChainClient([]), { onFailure })

      expect(result).toEqual({ descriptorPath: DESCRIPTOR_PATH, attestation: { status: 'unattested' } })
      expect(onFailure).not.toHaveBeenCalled()
    })
  })
})
