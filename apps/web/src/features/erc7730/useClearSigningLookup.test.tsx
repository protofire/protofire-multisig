import { eip712, type Transaction, type TypedData } from '@ethereum-sourcify/clear-signing'
import { faker } from '@faker-js/faker'
import { keccak256, toUtf8Bytes } from 'ethers'
import { http, HttpResponse } from 'msw'
import * as useChains from '@/hooks/useChains'
import { act, render, waitFor } from '@/tests/test-utils'
import { server } from '@/tests/server'
import {
  ClearSigningLookupProvider,
  useClearSigningLookupContext,
  type ClearSigningLookupContextValue,
} from './ClearSigningLookupContext'
import { mockRegistryConfig, REGISTRY_URL } from './testHelpers'
import type * as TestHelpers from './testHelpers'
import {
  formatCalldataInput,
  formatTypedDataInput,
  useClearSigningLookup,
  type ClearSigningFormatInput,
  type ClearSigningLookupResult,
} from './useClearSigningLookup'

jest.mock('@/config/constants.extra', () =>
  jest.requireActual<typeof TestHelpers>('./testHelpers').mockRegistryConstants(),
)
jest.mock('./externalDataProvider', () => ({
  useClearSigningExternalDataProvider: () =>
    jest.requireActual<typeof TestHelpers>('./testHelpers').noopExternalDataProvider,
}))

let registryUrl = REGISTRY_URL

const mockIndexes = (calldataIndex: object = {}, typedDataIndex: object = {}) =>
  server.use(
    http.get(`${registryUrl}/index.calldata.json`, () => HttpResponse.json(calldataIndex)),
    http.get(`${registryUrl}/index.eip712.json`, () => HttpResponse.json(typedDataIndex)),
  )

beforeEach(() => {
  jest.spyOn(useChains, 'useHasFeature').mockReturnValue(true)
  registryUrl = `${REGISTRY_URL}/${faker.string.alphanumeric(8)}`
  mockRegistryConfig.ERC7730_REGISTRY_URL = registryUrl
})

const createTx = (): Transaction => ({
  chainId: 1,
  to: faker.finance.ethereumAddress(),
  data: '0xa9059cbb' + '0'.repeat(128),
})

const Reader = ({ onValue }: { onValue: (value: ClearSigningLookupContextValue | null) => void }): null => {
  onValue(useClearSigningLookupContext())
  return null
}

type LookupProps<T> = {
  lookupKey: string
  input: T | undefined
  isEligible?: boolean
  formatInput: ClearSigningFormatInput<T>
  onResult?: (result: ClearSigningLookupResult) => void
}

const Lookup = <T,>({ lookupKey, input, isEligible = true, formatInput, onResult }: LookupProps<T>): null => {
  const result = useClearSigningLookup({ lookupKey, label: 'Swap', isEligible, input, formatInput })
  onResult?.(result)
  return null
}

const renderLookup = <T,>(props: Omit<LookupProps<T>, 'onResult'> | undefined) => {
  let context: ClearSigningLookupContextValue | null = null
  let result: ClearSigningLookupResult | undefined
  const tree = (nextProps: Omit<LookupProps<T>, 'onResult'> | undefined) => (
    <ClearSigningLookupProvider>
      <Reader onValue={(value) => (context = value)} />
      {nextProps && <Lookup {...nextProps} onResult={(value) => (result = value)} />}
    </ClearSigningLookupProvider>
  )
  const utils = render(tree(props))
  return {
    rerenderWith: (nextProps: Omit<LookupProps<T>, 'onResult'> | undefined) => utils.rerender(tree(nextProps)),
    context: () => context,
    result: () => result,
    request: (key: string) => act(() => context?.requestLookup(key)),
  }
}

describe('useClearSigningLookup', () => {
  describe('registration', () => {
    it('registers the entry and removes it again on unmount', () => {
      const { rerenderWith, context } = renderLookup({
        lookupKey: 'key-1',
        input: createTx(),
        formatInput: formatCalldataInput,
      })

      expect(context()?.entries['key-1']).toMatchObject({ label: 'Swap', eligible: true, status: 'idle' })

      rerenderWith(undefined)

      expect(context()?.entries['key-1']).toBeUndefined()
    })

    it('keeps a shared entry and its lookup state until the last registrar unmounts', async () => {
      mockIndexes()
      let context: ClearSigningLookupContextValue | null = null
      const tree = (count: number) => (
        <ClearSigningLookupProvider>
          <Reader onValue={(value) => (context = value)} />
          {Array.from({ length: count }, (_, index) => (
            <Lookup key={index} lookupKey="shared" input={createTx()} formatInput={formatCalldataInput} />
          ))}
        </ClearSigningLookupProvider>
      )
      const { rerender } = render(tree(2))
      const value = () => context as ClearSigningLookupContextValue | null

      act(() => value()?.requestLookup('shared'))
      await waitFor(() => expect(value()?.entries.shared.status).toBe('done'))

      rerender(tree(1))
      expect(value()?.entries.shared).toMatchObject({ status: 'done', outcome: 'not_found' })

      rerender(tree(0))
      expect(value()?.entries.shared).toBeUndefined()
    })

    it('replaces the entry when the key changes', () => {
      const { rerenderWith, context } = renderLookup({
        lookupKey: 'key-1',
        input: createTx(),
        formatInput: formatCalldataInput,
      })

      rerenderWith({ lookupKey: 'key-2', input: createTx(), formatInput: formatCalldataInput })

      expect(context()?.entries['key-1']).toBeUndefined()
      expect(context()?.entries['key-2']).toBeDefined()
    })

    it('registers an ineligible entry without an input and never fetches', async () => {
      const onRequest = jest.fn()
      server.use(http.get(`${registryUrl}/*`, onRequest))
      const { context, result, request } = renderLookup({
        lookupKey: 'key-1',
        input: undefined,
        isEligible: false,
        formatInput: formatCalldataInput,
      })

      expect(context()?.entries['key-1']).toMatchObject({ eligible: false, status: 'idle' })
      request('key-1')

      expect(result()?.isActive).toBe(false)
      expect(onRequest).not.toHaveBeenCalled()
    })

    it('does not re-create the entry when the input object identity changes', async () => {
      const tx = createTx()
      mockIndexes()
      const { rerenderWith, context, request } = renderLookup({
        lookupKey: 'key-1',
        input: tx,
        formatInput: formatCalldataInput,
      })
      request('key-1')
      await waitFor(() => expect(context()?.entries['key-1'].status).toBe('done'))

      rerenderWith({ lookupKey: 'key-1', input: { ...tx }, formatInput: formatCalldataInput })

      expect(context()?.entries['key-1']).toMatchObject({ status: 'done', outcome: 'not_found' })
    })
  })

  describe('formatting', () => {
    it('is inactive until the lookup is requested, then reports loading and the outcome', async () => {
      mockIndexes()
      const statuses: string[] = []
      const { context, result, request } = renderLookup({
        lookupKey: 'tx',
        input: createTx(),
        formatInput: formatCalldataInput,
      })
      expect(result()).toMatchObject({ isActive: false, loading: false })

      request('tx')
      await waitFor(() => {
        const entry = context()?.entries.tx
        const status = entry ? [entry.status, entry.outcome].filter(Boolean).join(':') : undefined
        if (status && statuses.at(-1) !== status) statuses.push(status)
        expect(statuses.at(-1)).toBe('done:not_found')
      })

      expect(statuses).toEqual(['loading', 'done:not_found'])
      expect(result()).toMatchObject({ isActive: true, loading: false, model: undefined, error: undefined })
    })

    it('formats a call with its descriptor and reports the descriptor source path', async () => {
      const tx = createTx()
      const path = 'registry/acme/calldata-acme.json'
      mockIndexes({ [`eip155:1:${tx.to.toLowerCase()}`]: path })
      server.use(
        http.get(`${registryUrl}/${path}`, () =>
          HttpResponse.json({
            context: { contract: { deployments: [{ chainId: 1, address: tx.to }] } },
            metadata: { owner: 'Acme' },
            display: {
              formats: {
                'transfer(address to, uint256 value)': {
                  intent: 'Send',
                  fields: [{ path: '#.value', label: 'Amount', format: 'raw' }],
                },
              },
            },
          }),
        ),
      )
      const { result, request } = renderLookup({ lookupKey: 'tx', input: tx, formatInput: formatCalldataInput })

      request('tx')

      await waitFor(() => expect(result()?.model).toBeDefined())
      expect(result()?.descriptorPath).toBe(path)
      expect(result()?.model).toMatchObject({
        intent: 'Send',
        fields: [expect.objectContaining({ label: 'Amount', value: '0' })],
      })
    })

    it('returns an error when a typed-data descriptor fails to load', async () => {
      const verifyingContract = faker.finance.ethereumAddress()
      const typedData: TypedData = {
        account: faker.finance.ethereumAddress(),
        domain: { chainId: 1, verifyingContract, name: 'Permit2', version: '1' },
        primaryType: 'PermitTransferFrom',
        types: { PermitTransferFrom: [{ name: 'spender', type: 'address' }] },
        message: { spender: faker.finance.ethereumAddress() },
      }
      const path = 'registry/uniswap/eip712-permit2.json'
      const encodeType = eip712.computeEncodeType(typedData.primaryType, typedData.types)
      const encodeTypeHash = keccak256(toUtf8Bytes(encodeType ?? ''))
      mockIndexes(
        {},
        { [`eip155:1:${verifyingContract}`]: { PermitTransferFrom: [{ path, encodeTypeHashes: [encodeTypeHash] }] } },
      )
      server.use(http.get(`${registryUrl}/${path}`, () => new HttpResponse(null, { status: 404 })))
      const { result, request } = renderLookup({
        lookupKey: 'typed',
        input: typedData,
        formatInput: formatTypedDataInput,
      })

      request('typed')

      await waitFor(() => expect(result()?.error).toBeDefined())
      expect(result()?.model).toBeUndefined()
      expect(result()?.error?.message).toContain('HTTP 404')
    })
  })
})
