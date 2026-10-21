import type { OffchainAttestation, Transaction } from '@ethereum-sourcify/clear-signing'
import { faker } from '@faker-js/faker'
import { getAddress } from 'ethers'
import { http, HttpResponse } from 'msw'
import * as useChains from '@/hooks/useChains'
import { logError } from '@/services/exceptions'
import { server } from '@/tests/server'
import { act, render, screen, waitFor } from '@/tests/test-utils'
import { ClearSigningLookupProvider, useClearSigningLookupContext } from '../ClearSigningLookupContext'
import { ClearSigningFoundChip } from '../ClearSigningPanel'
import { ClearSigningLookupStatusView } from '../ClearSigningStatus'
import { ERC7730_REGISTRY_SOURCE_BLOB_BASE } from '@/config/constants.extra'
import { createRegistryUrl, CYFRIN_ATTESTER as CYFRIN, mockRegistryConfig, REGISTRY_URL } from '../testHelpers'
import type * as TestHelpers from '../testHelpers'
import { calldataInputAdapter, useClearSigningLookup, type ClearSigningLookupResult } from '../useClearSigningLookup'
import wethAttestation from './__fixtures__/calldata-weth.eip155-1-0x3846c3A30E62075Fa916216b35EF04B8F53931f6.json'
import wethDescriptor from './__fixtures__/calldata-weth.json'

const EAS_MAINNET = '0xa1207f3bba224e2c9c3c6d5af63d0eb1582ce587'
const WETH_PATH = 'registry/weth/calldata-weth.json'
const WETH_SIGS_PATH = `registry/weth/sigs/calldata-weth.eip155-1-${CYFRIN}.json`
const CYFRIN_PROFILE_PATH = `auditors/eip155-1-${CYFRIN}/profile.json`
const CYFRIN_PROFILE = { id: `eip155:1:${CYFRIN}`, name: 'Patrick Collins', organization: 'Cyfrin' }
const AAVE_PATH = 'registry/aave/calldata-lpv3.json'
const AAVE_POOL = '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2'
const NOT_REVOKED = `0x${'0'.repeat(64)}`
const REVOKED = `0x${'0'.repeat(63)}1`

const mockChainCall = jest.fn<Promise<string>, [number, { to: string; data: string }]>()

jest.mock('@/services/exceptions', () => ({
  ...jest.requireActual<Record<string, unknown>>('@/services/exceptions'),
  logError: jest.fn(),
}))
jest.mock('@/config/constants.extra', () =>
  jest.requireActual<typeof TestHelpers>('../testHelpers').mockRegistryConstants(),
)
jest.mock('../externalDataProvider', () => ({
  useClearSigningExternalDataProvider: () => ({
    ...jest.requireActual<typeof TestHelpers>('../testHelpers').noopExternalDataProvider,
    chainClient: { call: mockChainCall },
  }),
}))

let registryUrl = REGISTRY_URL

const mockRegistry = ({
  attestation = wethAttestation,
  profile = CYFRIN_PROFILE,
  descriptor = wethDescriptor,
}: { attestation?: OffchainAttestation; profile?: unknown; descriptor?: Record<string, unknown> } = {}) =>
  server.use(
    http.get(`${registryUrl}/index.calldata.json`, () =>
      HttpResponse.json({
        'eip155:1:0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2': WETH_PATH,
        'eip155:11155111:0xfff9976782d46cc05630d1f6ebab18b2324d6b14': WETH_PATH,
        [`eip155:1:${AAVE_POOL.toLowerCase()}`]: AAVE_PATH,
      }),
    ),
    http.get(`${registryUrl}/index.eip712.json`, () => HttpResponse.json({})),
    http.get(`${registryUrl}/${WETH_PATH}`, () => HttpResponse.json(descriptor)),
    http.get(`${registryUrl}/${AAVE_PATH}`, () =>
      HttpResponse.json({
        context: { contract: { deployments: [{ chainId: 1, address: AAVE_POOL }] } },
        metadata: { owner: 'Aave' },
        display: {
          formats: {
            'supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode)': {
              intent: 'Supply',
              fields: [{ path: '#.amount', label: 'Amount', format: 'raw' }],
            },
          },
        },
      }),
    ),
    http.get(`${registryUrl}/${WETH_SIGS_PATH}`, () => HttpResponse.json(attestation)),
    http.get(new RegExp('/sigs/'), () => new HttpResponse(null, { status: 404 })),
    http.get(`${registryUrl}/${CYFRIN_PROFILE_PATH}`, () =>
      profile ? HttpResponse.json(profile) : new HttpResponse(null, { status: 404 }),
    ),
  )

const wrapEth = (chainId: number): Transaction => ({
  chainId,
  to: chainId === 1 ? '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2' : '0xfff9976782d46cc05630d1f6ebab18b2324d6b14',
  data: '0xd0e30db0',
  value: 10n ** 18n,
})

const supplyToAave = (): Transaction => ({
  chainId: 1,
  to: AAVE_POOL,
  data: '0x617ba037' + '0'.repeat(256),
})

const Review = ({ tx, onResult }: { tx: Transaction; onResult: (result: ClearSigningLookupResult) => void }) => {
  const lookupContext = useClearSigningLookupContext()
  const lookup = useClearSigningLookup({
    lookupKey: 'tx',
    label: 'Contract call',
    isEligible: true,
    input: tx,
    adapter: calldataInputAdapter,
  })
  onResult(lookup)
  return (
    <>
      <button onClick={() => lookupContext?.requestLookup('tx')}>Look up</button>
      {lookup.model && <ClearSigningFoundChip attestation={lookup.attestation} />}
      <ClearSigningLookupStatusView lookup={lookup} subject="call" />
    </>
  )
}

const getAttester = (result: ClearSigningLookupResult | undefined) =>
  result?.attestation?.status === 'attested' ? result.attestation.attester : undefined

const review = async (tx: Transaction): Promise<ClearSigningLookupResult | undefined> => {
  let result: ClearSigningLookupResult | undefined
  render(
    <ClearSigningLookupProvider>
      <Review tx={tx} onResult={(value) => (result = value)} />
    </ClearSigningLookupProvider>,
  )
  act(() => screen.getByText('Look up').click())
  await waitFor(() => expect(result?.loading).toBe(false))
  await waitFor(() => expect(result?.attestation).toBeDefined())
  return result
}

beforeEach(() => {
  jest.spyOn(useChains, 'useHasFeature').mockReturnValue(true)
  registryUrl = createRegistryUrl()
  mockRegistryConfig.ERC7730_REGISTRY_URL = registryUrl
  mockRegistryConfig.ERC8176_TRUSTED_ATTESTERS = [CYFRIN]
  mockChainCall.mockReset().mockResolvedValue(NOT_REVOKED)
  jest.mocked(logError).mockClear()
})

const expectPanelWithStatus = (status: string, text: string) => {
  expect(screen.getByTestId('erc7730-clear-signing-panel')).toBeInTheDocument()
  expect(screen.getByTestId(`erc8176-status-${status}`)).toHaveTextContent(text)
  expect(screen.queryByTestId('erc8176-attestation-badge')).not.toBeInTheDocument()
}

const expectUnattested = () => {
  expectPanelWithStatus('unattested', 'This version of the descriptor is not reviewed by a trusted auditor yet')
  expect(screen.getByTestId('erc8176-status-unattested')).not.toHaveClass('MuiAlert-root')
  expect(screen.getByTestId('erc7730-check-hint')).toHaveTextContent(/^ERC-7730 found$/)
}

const expectRevoked = () => {
  expectPanelWithStatus('revoked', 'The auditor revoked their attestation for this descriptor')
  expect(screen.getByTestId('erc8176-status-revoked')).toHaveClass('MuiAlert-standardWarning')
  expect(screen.getByTestId('erc7730-check-hint')).toHaveTextContent('ERC-7730 found - revoked')
}

describe('ERC-8176 attestation status', () => {
  it.each([
    ['mainnet', 1],
    ['Sepolia', 11155111],
  ])('shows the WETH %s panel with a Reviewed by Cyfrin badge', async (_, chainId) => {
    mockRegistry()

    const result = await review(wrapEth(chainId))

    expect(result).toMatchObject({
      attestation: {
        status: 'attested',
        attester: {
          address: CYFRIN,
          name: 'Patrick Collins',
          organization: 'Cyfrin',
          attestedAt: Number(wethAttestation.sig.message.time),
          attestationPath: WETH_SIGS_PATH,
        },
      },
    })
    expect(result?.model).toMatchObject({ intent: 'Wrap' })
    expect(getAttester(result)?.expiresAt).toBeUndefined()
    expect(mockChainCall).toHaveBeenCalledWith(1, expect.objectContaining({ to: EAS_MAINNET }))
    expect(screen.getByTestId('erc7730-clear-signing-panel')).toBeInTheDocument()
    expect(screen.getByTestId('erc7730-check-hint')).toHaveTextContent(/^ERC-7730 found$/)
    expect(screen.getByTestId('erc8176-attester')).toHaveTextContent('Reviewed by Cyfrin')
    expect(screen.getByTestId('erc8176-attester')).toHaveAttribute('aria-label', `Patrick Collins\n${CYFRIN}`)
    expect(screen.getByTestId('erc8176-attestation-dates')).toHaveTextContent('Attested Jul 29, 2026')
    expect(screen.getByTestId('erc8176-attestation-dates')).not.toHaveTextContent('Expires')
    expect(screen.getByTestId('erc8176-attestation-link')).toHaveAttribute(
      'href',
      `${ERC7730_REGISTRY_SOURCE_BLOB_BASE}/${WETH_SIGS_PATH}`,
    )
  })

  it('falls back to the attester address when the registry publishes no profile', async () => {
    mockRegistry({ profile: null })

    const result = await review(wrapEth(1))

    expect(result).toMatchObject({ attestation: { status: 'attested', attester: { address: CYFRIN } } })
    expect(getAttester(result)?.organization).toBeUndefined()
    expect(screen.getByTestId('erc8176-attester')).toHaveTextContent('Reviewed by 0x3846...31f6')
    expect(screen.getByTestId('erc8176-attester')).toHaveAttribute('aria-label', CYFRIN)
  })

  it('shows the Aave v3 Pool panel as not reviewed when no sigs/ file exists', async () => {
    mockRegistry()

    const result = await review(supplyToAave())

    expect(result).toMatchObject({ attestation: { status: 'unattested' }, descriptorPath: AAVE_PATH })
    expect(result?.model).toMatchObject({ intent: 'Supply' })
    expect(mockChainCall).not.toHaveBeenCalled()
    expectUnattested()
  })

  it('renders a revoked descriptor with a warning and a revoked chip', async () => {
    mockRegistry()
    mockChainCall.mockResolvedValue(REVOKED)

    const result = await review(wrapEth(1))

    expect(result).toMatchObject({
      attestation: { status: 'revoked' },
      model: expect.objectContaining({ intent: 'Wrap' }),
    })
    expect(screen.getByTestId('clear-signing-summary-tag-WETH')).toBeInTheDocument()
    expectRevoked()
  })

  it('reports an unattested descriptor when the revocation state cannot be read', async () => {
    mockRegistry()
    mockChainCall.mockRejectedValue(new Error('RPC unavailable'))

    const result = await review(wrapEth(1))

    expect(result).toMatchObject({ attestation: { status: 'unattested' }, error: undefined })
    expectUnattested()
    expect(logError).not.toHaveBeenCalled()
  })

  it('logs an attestation check that fails for a reason other than the network', async () => {
    mockRegistry()
    mockChainCall.mockResolvedValue('0x')

    const result = await review(wrapEth(1))

    expect(result).toMatchObject({ attestation: { status: 'unattested' }, error: undefined })
    expect(logError).toHaveBeenCalledWith(expect.stringContaining('821'), expect.any(Error))
  })

  it('reports a descriptor edited after it was attested as unattested, without a warning', async () => {
    const edited = {
      ...wethDescriptor,
      context: {
        ...wethDescriptor.context,
        contract: {
          ...wethDescriptor.context.contract,
          deployments: [...wethDescriptor.context.contract.deployments, { chainId: 42161, address: AAVE_POOL }],
        },
      },
    }
    mockRegistry({ descriptor: edited })

    const result = await review(wrapEth(1))

    expect(result).toMatchObject({
      attestation: { status: 'unattested' },
      model: expect.objectContaining({ intent: 'Wrap' }),
    })
    expect(mockChainCall).not.toHaveBeenCalled()
    expectUnattested()
  })

  it('reports a descriptor whose attestation does not verify as unattested, without a warning', async () => {
    const r = wethAttestation.sig.signature.r
    const tampered = {
      ...wethAttestation,
      sig: { ...wethAttestation.sig, signature: { ...wethAttestation.sig.signature, r: `${r.slice(0, -2)}00` } },
    }
    mockRegistry({ attestation: tampered })

    const result = await review(wrapEth(1))

    expect(result).toMatchObject({ attestation: { status: 'unattested' } })
    expect(mockChainCall).not.toHaveBeenCalled()
    expectUnattested()
  })

  it('ignores the Cyfrin attestation when only a different attester is trusted', async () => {
    mockRegistry()
    mockRegistryConfig.ERC8176_TRUSTED_ATTESTERS = [getAddress(faker.finance.ethereumAddress())]

    const result = await review(wrapEth(1))

    expect(result).toMatchObject({ attestation: { status: 'unattested' } })
    expectUnattested()
  })
})
