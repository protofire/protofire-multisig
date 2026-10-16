import { faker } from '@faker-js/faker'
import { http, HttpResponse } from 'msw'
import { server } from '@/tests/server'
import { getRegistryResolver } from './registryResolver'

const calldataIndex = { 'eip155:1:0x0000000000000000000000000000000000000001': 'registry/acme/calldata-acme.json' }
const typedDataIndex = {
  'eip155:1:0x0000000000000000000000000000000000000002': {
    Permit: [{ path: 'registry/acme/eip712-acme.json', encodeTypeHashes: ['0x01'] }],
  },
}

const createBaseUrl = () => `https://${faker.internet.domainName()}/erc7730/${faker.git.commitSha({ length: 7 })}`

const mockIndexes = (baseUrl: string, onRequest?: () => void) => {
  server.use(
    http.get(`${baseUrl}/index.calldata.json`, () => {
      onRequest?.()
      return HttpResponse.json(calldataIndex)
    }),
    http.get(`${baseUrl}/index.eip712.json`, () => HttpResponse.json(typedDataIndex)),
  )
}

describe('getRegistryResolver', () => {
  it('combines both index files and fetches descriptors relative to the base URL', async () => {
    const baseUrl = createBaseUrl()
    const descriptor = { context: {}, metadata: { owner: 'Acme' }, display: { formats: {} } }
    mockIndexes(baseUrl)
    server.use(http.get(`${baseUrl}/ercs/calldata-erc20-tokens.json`, () => HttpResponse.json(descriptor)))

    const resolver = await getRegistryResolver(baseUrl)

    expect(resolver.index).toEqual({ calldataIndex, typedDataIndex })
    await expect(resolver.fetchDescriptor('ercs/calldata-erc20-tokens.json')).resolves.toEqual(descriptor)
  })

  it('rejects with the HTTP status when a descriptor is missing', async () => {
    const baseUrl = createBaseUrl()
    mockIndexes(baseUrl)
    server.use(http.get(`${baseUrl}/registry/acme/missing.json`, () => new HttpResponse(null, { status: 404 })))

    const resolver = await getRegistryResolver(baseUrl)

    await expect(resolver.fetchDescriptor('registry/acme/missing.json')).rejects.toThrow('HTTP 404')
  })

  it('rejects a malformed index', async () => {
    const baseUrl = createBaseUrl()
    server.use(
      http.get(`${baseUrl}/index.calldata.json`, () => HttpResponse.json(['registry/acme/calldata-acme.json'])),
      http.get(`${baseUrl}/index.eip712.json`, () => HttpResponse.json(typedDataIndex)),
    )

    await expect(getRegistryResolver(baseUrl)).rejects.toThrow('Malformed ERC-7730 registry index')
  })

  it('fetches the index once per base URL', async () => {
    const baseUrl = createBaseUrl()
    const onRequest = jest.fn()
    mockIndexes(baseUrl, onRequest)

    const [first, second] = await Promise.all([getRegistryResolver(baseUrl), getRegistryResolver(baseUrl)])
    await getRegistryResolver(baseUrl)

    expect(first).toBe(second)
    expect(onRequest).toHaveBeenCalledTimes(1)
  })

  it('retries on the next call after a failed index fetch', async () => {
    const baseUrl = createBaseUrl()
    mockIndexes(baseUrl)
    server.use(
      http.get(`${baseUrl}/index.calldata.json`, () => new HttpResponse(null, { status: 500 }), { once: true }),
    )

    await expect(getRegistryResolver(baseUrl)).rejects.toThrow('HTTP 500')

    const resolver = await getRegistryResolver(baseUrl)
    expect(resolver.index.calldataIndex).toEqual(calldataIndex)
  })
})
