import type { ExternalDataProvider } from '@ethereum-sourcify/clear-signing'

export const REGISTRY_URL = 'https://assets.example.com/erc7730/abc1234'

export const mockRegistryConfig = { ERC7730_REGISTRY_URL: REGISTRY_URL }

export const mockRegistryConstants = () => ({
  ...jest.requireActual<Record<string, unknown>>('@/config/constants.extra'),
  get ERC7730_REGISTRY_URL() {
    return mockRegistryConfig.ERC7730_REGISTRY_URL
  },
})

export const noopExternalDataProvider: ExternalDataProvider = {
  resolveLocalName: async () => null,
  resolveEnsName: async () => null,
  resolveChainInfo: async () => null,
  resolveToken: async () => null,
}
