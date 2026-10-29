import type { ExternalDataProvider } from '@ethereum-sourcify/clear-signing'
import { faker } from '@faker-js/faker'
import { http, HttpResponse } from 'msw'
import { server } from '@/tests/server'

export const REGISTRY_URL = 'https://assets.example.com/erc7730/abc1234'
export const CYFRIN_ATTESTER = '0x3846c3A30E62075Fa916216b35EF04B8F53931f6'

export const createBaseUrl = (): string =>
  `https://${faker.internet.domainName()}/erc7730/${faker.git.commitSha({ length: 7 })}`

export const createRegistryUrl = (): string => `${REGISTRY_URL}/${faker.string.alphanumeric(8)}`

export const mockRegistryConfig = { ERC7730_REGISTRY_URL: REGISTRY_URL, ERC8176_TRUSTED_ATTESTERS: [CYFRIN_ATTESTER] }

export const mockRegistryConstants = () => ({
  ...jest.requireActual<Record<string, unknown>>('@/config/constants.extra'),
  get ERC7730_REGISTRY_URL() {
    return mockRegistryConfig.ERC7730_REGISTRY_URL
  },
  get ERC8176_TRUSTED_ATTESTERS() {
    return mockRegistryConfig.ERC8176_TRUSTED_ATTESTERS
  },
})

type MockRegistryIndexesOptions = {
  calldataIndex?: object
  typedDataIndex?: object
  onRequest?: () => void
}

export const mockRegistryIndexes = (
  baseUrl: string,
  { calldataIndex = {}, typedDataIndex = {}, onRequest }: MockRegistryIndexesOptions = {},
) =>
  server.use(
    http.get(`${baseUrl}/index.calldata.json`, () => {
      onRequest?.()
      return HttpResponse.json(calldataIndex)
    }),
    http.get(`${baseUrl}/index.eip712.json`, () => HttpResponse.json(typedDataIndex)),
  )

export const noopExternalDataProvider: ExternalDataProvider = {
  resolveLocalName: async () => null,
  resolveEnsName: async () => null,
  resolveChainInfo: async () => null,
  resolveToken: async () => null,
}

export const SAFE_PROXY_RUNTIME_CODE_1_4_1 =
  '0x608060405273ffffffffffffffffffffffffffffffffffffffff600054167fa619486e0000000000000000000000000000000000000000000000000000000060003514156050578060005260206000f35b3660008037600080366000845af43d6000803e60008114156070573d6000fd5b3d6000f3fea264697066735822122003d1488ee65e08fa41e58e888a9865554c535f2c77126a82cb4c0f917f31441364736f6c63430007060033'
