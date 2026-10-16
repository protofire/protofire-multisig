import { JsonRpcProvider } from 'ethers'
import { EMPTY_DATA, ZERO_ADDRESS } from '@safe-global/protocol-kit/dist/src/utils/constants'
import * as web3 from '@/hooks/wallets/web3'
import Safe from '@safe-global/protocol-kit'
import {
  relaySafeCreation,
  getRedirect,
  createNewSafe,
  createNewUndeployedSafeWithoutSalt,
} from '@/components/new-safe/create/logic/index'
import { activateReplayedSafe } from '@/features/counterfactual/services'
import { toBeHex } from 'ethers'
import { chainBuilder } from '@/tests/builders/chains'
import { type ReplayedSafeProps } from '@safe-global/utils/features/counterfactual/store/types'
import { faker } from '@faker-js/faker'
import { ECOSYSTEM_ID_ADDRESS } from '@/config/constants'
import {
  getFallbackHandlerDeployment,
  getProxyFactoryDeployment,
  getSafeL2SingletonDeployment,
  getSafeSingletonDeployment,
  getSafeToL2SetupDeployment,
} from '@safe-global/safe-deployments'
import { Safe_to_l2_setup__factory } from '@safe-global/utils/types/contracts'
import { FEATURES, getLatestSafeVersion } from '@safe-global/utils/utils/chains'
import * as safeDeployments from '@safe-global/safe-deployments'
import type { SingletonDeploymentV2 } from '@safe-global/safe-deployments'
import { http, HttpResponse } from 'msw'
import { server } from '@/tests/server'
import { GATEWAY_URL } from '@/config/gateway'
import { fail } from 'assert'

const provider = new JsonRpcProvider(undefined, { name: 'ethereum', chainId: 1 })

const latestSafeVersion = getLatestSafeVersion(
  chainBuilder().with({ chainId: '1', recommendedMasterCopyVersion: '1.4.1' }).build(),
)

describe('create/logic', () => {
  describe('createNewSafeViaRelayer', () => {
    const owner1 = toBeHex('0x1', 20)
    const owner2 = toBeHex('0x2', 20)

    const mockChainInfo = chainBuilder()
      .with({
        chainId: '1',
        l2: false,
        recommendedMasterCopyVersion: '1.4.1',
      })
      .build()

    const mockProxyFactoryAddress = faker.finance.ethereumAddress()
    const mockFallbackHandlerAddress = faker.finance.ethereumAddress()
    const mockSafeContractAddress = faker.finance.ethereumAddress()

    beforeAll(() => {
      jest.resetAllMocks()
      jest.spyOn(web3, 'getWeb3ReadOnly').mockImplementation(() => provider)

      // Initialize store for tests that need it (e.g., relaySafeCreation)
      const { makeStore, setStoreInstance } = require('@/store')
      const testStore = makeStore({}, { skipBroadcast: true })
      setStoreInstance(testStore)
    })

    beforeEach(() => {
      // No contract mocking needed - tests use mock addresses directly in undeployedSafeProps
      jest.clearAllMocks()
    })

    it('returns taskId if create Safe successfully relayed', async () => {
      const undeployedSafeProps: ReplayedSafeProps = {
        safeAccountConfig: {
          owners: [owner1, owner2],
          threshold: 1,
          data: EMPTY_DATA,
          to: ZERO_ADDRESS,
          fallbackHandler: mockFallbackHandlerAddress,
          paymentReceiver: ZERO_ADDRESS,
          payment: 0,
          paymentToken: ZERO_ADDRESS,
        },
        safeVersion: latestSafeVersion,
        factoryAddress: mockProxyFactoryAddress,
        masterCopy: mockSafeContractAddress,
        saltNonce: '69',
      }

      const expectedTaskId = '0x123'

      // Setup MSW handler for relay endpoint
      server.use(
        http.post(`${GATEWAY_URL}/v1/chains/1/relay`, () => {
          return HttpResponse.json({ taskId: expectedTaskId })
        }),
      )

      const taskId = await relaySafeCreation(mockChainInfo, undeployedSafeProps)

      expect(taskId).toEqual(expectedTaskId)
    })

    it('should throw an error if relaying fails', async () => {
      const undeployedSafeProps: ReplayedSafeProps = {
        safeAccountConfig: {
          owners: [owner1, owner2],
          threshold: 1,
          data: EMPTY_DATA,
          to: ZERO_ADDRESS,
          fallbackHandler: faker.finance.ethereumAddress(),
          paymentReceiver: ZERO_ADDRESS,
          payment: 0,
          paymentToken: ZERO_ADDRESS,
        },
        safeVersion: latestSafeVersion,
        factoryAddress: faker.finance.ethereumAddress(),
        masterCopy: faker.finance.ethereumAddress(),
        saltNonce: '69',
      }

      // Setup MSW handler to return a server error that RTK treats as a fetch error
      server.use(
        http.post(`${GATEWAY_URL}/v1/chains/1/relay`, () => {
          return HttpResponse.error()
        }),
      )

      // RTK's fetchBaseQuery returns a rejected promise for network errors
      try {
        await relaySafeCreation(mockChainInfo, undeployedSafeProps)
        fail('Should have thrown an error')
      } catch (error) {
        console.log('error', error)
        // Error should be thrown
        expect(error).toBeDefined()
      }
    })
  })
  describe('getRedirect', () => {
    it("should redirect to home for any redirect that doesn't start with /apps", () => {
      const expected = {
        pathname: '/home',
        query: {
          safe: 'sep:0x1234',
        },
      }
      expect(getRedirect('sep', '0x1234', 'https://google.com')).toEqual(expected)
      expect(getRedirect('sep', '0x1234', '/queue')).toEqual(expected)
    })

    it('should redirect to an app if an app URL is passed', () => {
      expect(getRedirect('sep', '0x1234', '/apps?appUrl=https://safe-eth.everstake.one/?chain=eth')).toEqual(
        '/apps?appUrl=https://safe-eth.everstake.one/?chain=eth&safe=sep:0x1234',
      )

      expect(getRedirect('sep', '0x1234', '/apps?appUrl=https://safe-eth.everstake.one')).toEqual(
        '/apps?appUrl=https://safe-eth.everstake.one&safe=sep:0x1234',
      )
    })
  })

  describe('createNewUndeployedSafeWithoutSalt', () => {
    it('should throw errors if no deployments are found', () => {
      expect(() =>
        createNewUndeployedSafeWithoutSalt(
          '1.4.1',
          {
            owners: [faker.finance.ethereumAddress()],
            threshold: 1,
          },
          chainBuilder().with({ chainId: 'NON_EXISTING' }).build(),
        ),
      ).toThrowError(new Error('No Safe deployment found'))
    })

    it('should use l1 masterCopy and no migration on l1s without multichain feature', () => {
      const safeSetup = {
        owners: [faker.finance.ethereumAddress()],
        threshold: 1,
      }
      expect(
        createNewUndeployedSafeWithoutSalt(
          '1.4.1',
          safeSetup,
          chainBuilder()
            .with({ chainId: '1' })
            // Multichain creation is toggled off
            .with({ features: [FEATURES.COUNTERFACTUAL] as any })
            .with({ l2: false })
            .build(),
        ),
      ).toEqual({
        safeAccountConfig: {
          ...safeSetup,
          fallbackHandler: getFallbackHandlerDeployment({ version: '1.4.1', network: '1' })?.defaultAddress,
          to: ZERO_ADDRESS,
          data: EMPTY_DATA,
          paymentReceiver: ECOSYSTEM_ID_ADDRESS,
        },
        safeVersion: '1.4.1',
        masterCopy: getSafeSingletonDeployment({ version: '1.4.1', network: '1' })?.defaultAddress,
        factoryAddress: getProxyFactoryDeployment({ version: '1.4.1', network: '1' })?.defaultAddress,
      })
    })

    it('should use l2 masterCopy and no migration on l2s without multichain feature', () => {
      const safeSetup = {
        owners: [faker.finance.ethereumAddress()],
        threshold: 1,
      }
      expect(
        createNewUndeployedSafeWithoutSalt(
          '1.4.1',
          safeSetup,
          chainBuilder()
            .with({ chainId: '137' })
            // Multichain creation is toggled off
            .with({ features: [FEATURES.COUNTERFACTUAL] as any })
            .with({ recommendedMasterCopyVersion: '1.4.1' })
            .with({ l2: true })
            .build(),
        ),
      ).toEqual({
        safeAccountConfig: {
          ...safeSetup,
          fallbackHandler: getFallbackHandlerDeployment({ version: '1.4.1', network: '137' })?.defaultAddress,
          to: ZERO_ADDRESS,
          data: EMPTY_DATA,
          paymentReceiver: ECOSYSTEM_ID_ADDRESS,
        },
        safeVersion: '1.4.1',
        masterCopy: getSafeL2SingletonDeployment({ version: '1.4.1', network: '137' })?.defaultAddress,
        factoryAddress: getProxyFactoryDeployment({ version: '1.4.1', network: '137' })?.defaultAddress,
      })
    })

    it('should use l2 masterCopy and no migration on l2s with multichain feature but on old version', () => {
      const safeSetup = {
        owners: [faker.finance.ethereumAddress()],
        threshold: 1,
      }
      expect(
        createNewUndeployedSafeWithoutSalt(
          '1.3.0',
          safeSetup,
          chainBuilder()
            .with({ chainId: '137' })
            // Multichain creation is toggled on
            .with({ features: [FEATURES.COUNTERFACTUAL, FEATURES.MULTI_CHAIN_SAFE_CREATION] as any })
            .with({ recommendedMasterCopyVersion: '1.3.0' })
            .with({ l2: true })
            .build(),
        ),
      ).toEqual({
        safeAccountConfig: {
          ...safeSetup,
          fallbackHandler: getFallbackHandlerDeployment({ version: '1.3.0', network: '137' })?.defaultAddress,
          to: ZERO_ADDRESS,
          data: EMPTY_DATA,
          paymentReceiver: ECOSYSTEM_ID_ADDRESS,
        },
        safeVersion: '1.3.0',
        masterCopy: getSafeL2SingletonDeployment({ version: '1.3.0', network: '137' })?.defaultAddress,
        factoryAddress: getProxyFactoryDeployment({ version: '1.3.0', network: '137' })?.defaultAddress,
      })
    })

    it('should use l1 masterCopy and migration on l2s with multichain feature', () => {
      const safeSetup = {
        owners: [faker.finance.ethereumAddress()],
        threshold: 1,
      }
      const chainSetup = chainBuilder()
        .with({ chainId: '137' })
        // Multichain creation is toggled on
        .with({ features: [FEATURES.COUNTERFACTUAL, FEATURES.MULTI_CHAIN_SAFE_CREATION] as any })
        .with({ recommendedMasterCopyVersion: '1.4.1' })
        .with({ l2: true })
        .build()

      const safeL2SingletonDeployment = getSafeL2SingletonDeployment({
        version: '1.4.1',
        network: '137',
      })?.defaultAddress

      const safeToL2SetupDeployment = getSafeToL2SetupDeployment({ version: '1.4.1', network: chainSetup.chainId })
      const safeToL2SetupAddress = safeToL2SetupDeployment?.networkAddresses[chainSetup.chainId]
      const safeToL2SetupInterface = Safe_to_l2_setup__factory.createInterface()

      expect(createNewUndeployedSafeWithoutSalt('1.4.1', safeSetup, chainSetup)).toEqual({
        safeAccountConfig: {
          ...safeSetup,
          fallbackHandler: getFallbackHandlerDeployment({ version: '1.4.1', network: '137' })?.defaultAddress,
          to: safeToL2SetupAddress,
          data:
            safeL2SingletonDeployment &&
            safeToL2SetupInterface.encodeFunctionData('setupToL2', [safeL2SingletonDeployment]),
          paymentReceiver: ECOSYSTEM_ID_ADDRESS,
        },
        safeVersion: '1.4.1',
        masterCopy: getSafeSingletonDeployment({ version: '1.4.1', network: '137' })?.defaultAddress,
        factoryAddress: getProxyFactoryDeployment({ version: '1.4.1', network: '137' })?.defaultAddress,
      })
    })

    it('should use l2 masterCopy and no migration on zkSync', () => {
      const safeSetup = {
        owners: [faker.finance.ethereumAddress()],
        threshold: 1,
      }
      expect(
        createNewUndeployedSafeWithoutSalt(
          '1.3.0',
          safeSetup,
          chainBuilder()
            .with({ chainId: '324' })
            // Multichain and 1.4.1 creation is toggled off
            .with({ features: [FEATURES.COUNTERFACTUAL] as any })
            .with({ recommendedMasterCopyVersion: '1.3.0' })
            .with({ l2: true })
            .build(),
        ),
      ).toEqual({
        safeAccountConfig: {
          ...safeSetup,
          fallbackHandler: getFallbackHandlerDeployment({ version: '1.3.0', network: '324' })?.defaultAddress,
          to: ZERO_ADDRESS,
          data: EMPTY_DATA,
          paymentReceiver: ECOSYSTEM_ID_ADDRESS,
        },
        safeVersion: '1.3.0',
        masterCopy: getSafeL2SingletonDeployment({ version: '1.3.0', network: '324' })?.defaultAddress,
        factoryAddress: getProxyFactoryDeployment({ version: '1.3.0', network: '324' })?.defaultAddress,
      })
    })

    it('prefers canonical address when not first in networkAddresses', () => {
      const chain = chainBuilder()
        .with({ chainId: '1' })
        .with({ features: [FEATURES.COUNTERFACTUAL] as any })
        .with({ l2: false })
        .build()

      const safeSetup = {
        owners: [faker.finance.ethereumAddress()],
        threshold: 1,
      }

      const canonical = faker.finance.ethereumAddress()
      const firstNonCanonical = faker.finance.ethereumAddress()

      const mockDeployment: SingletonDeploymentV2 = {
        version: '1.4.1',
        contractName: 'CompatibilityFallbackHandler',
        networkAddresses: { [chain.chainId]: [firstNonCanonical, canonical] },
        deployments: {
          canonical: { address: canonical },
        },
        defaultAddress: canonical,
      } as unknown as SingletonDeploymentV2

      const spy = jest
        .spyOn(safeDeployments, 'getCompatibilityFallbackHandlerDeployments')
        .mockReturnValue(mockDeployment)

      const result = createNewUndeployedSafeWithoutSalt('1.4.1', safeSetup, chain)

      expect(result.safeAccountConfig.fallbackHandler).toEqual(canonical)

      spy.mockRestore()
    })

    it('falls back to first network address when canonical not present for chain', () => {
      const chain = chainBuilder()
        .with({ chainId: '1' })
        .with({ features: [FEATURES.COUNTERFACTUAL] as any })
        .with({ l2: false })
        .build()

      const safeSetup = {
        owners: [faker.finance.ethereumAddress()],
        threshold: 1,
      }

      const canonical = faker.finance.ethereumAddress()
      const firstAddress = faker.finance.ethereumAddress()

      const mockDeployment: SingletonDeploymentV2 = {
        version: '1.4.1',
        contractName: 'CompatibilityFallbackHandler',
        networkAddresses: { [chain.chainId]: [firstAddress] },
        deployments: {
          canonical: { address: canonical },
        },
        defaultAddress: canonical,
      } as unknown as SingletonDeploymentV2

      const spy = jest
        .spyOn(safeDeployments, 'getCompatibilityFallbackHandlerDeployments')
        .mockReturnValue(mockDeployment)

      const result = createNewUndeployedSafeWithoutSalt('1.4.1', safeSetup, chain)

      expect(result.safeAccountConfig.fallbackHandler).toEqual(firstAddress)

      spy.mockRestore()
    })
  })

  describe('createNewSafe', () => {
    const owner = faker.finance.ethereumAddress()
    const hash = `0x${'ab'.repeat(32)}`
    const replayedProps: ReplayedSafeProps = {
      safeAccountConfig: {
        owners: [owner],
        threshold: 1,
        data: EMPTY_DATA,
        to: ZERO_ADDRESS,
        fallbackHandler: ZERO_ADDRESS,
        paymentReceiver: ZERO_ADDRESS,
        payment: 0,
        paymentToken: ZERO_ADDRESS,
      },
      safeVersion: latestSafeVersion,
      factoryAddress: faker.finance.ethereumAddress(),
      masterCopy: faker.finance.ethereumAddress(),
      saltNonce: '69',
    }
    const predictedProps = { safeAccountConfig: { owners: [owner], threshold: 1 }, safeDeploymentConfig: {} }
    const pendingTransaction = {
      hash,
      blockHash: null,
      blockNumber: null,
      transactionIndex: null,
      from: owner,
      to: replayedProps.factoryAddress,
      gas: '0x1',
      gasPrice: '0x1',
      input: '0x',
      nonce: '0x0',
      value: '0x0',
      type: '0x0',
      v: '0x1b',
      r: `0x${'11'.repeat(32)}`,
      s: `0x${'22'.repeat(32)}`,
    }

    const create = async (chainId: string, props: Parameters<typeof createNewSafe>[1]) => {
      const requested: string[] = []
      const answers: Record<string, unknown> = {
        eth_chainId: toBeHex(chainId),
        eth_accounts: [owner],
        eth_blockNumber: '0x1',
        eth_sendTransaction: hash,
        eth_getTransactionByHash: pendingTransaction,
      }
      const walletProvider = {
        request: async ({ method }: { method: string }) => {
          requested.push(method)
          return answers[method]
        },
      }
      const callback = jest.fn()
      const chain = chainBuilder().with({ chainId }).build()

      await createNewSafe(walletProvider, props, chain, { gasLimit: 1 }, callback, undefined, activateReplayedSafe)

      expect(callback).toHaveBeenCalledWith(hash)
      return requested
    }

    beforeEach(() => {
      jest.spyOn(Safe, 'init').mockResolvedValue({
        createSafeDeploymentTransaction: async () => ({ to: replayedProps.factoryAddress, value: '0', data: '0x1234' }),
      } as unknown as Safe)
    })

    afterEach(() => jest.restoreAllMocks())

    it.each([
      ['replayed', replayedProps],
      ['predicted', predictedProps],
    ])('hands the hash over on Tron without waiting for the transaction to be readable (%s)', async (_name, props) => {
      const requested = await create('728126428', props)

      expect(requested).toContain('eth_sendTransaction')
      expect(requested).not.toContain('eth_getTransactionByHash')
    })

    it.each([
      ['replayed', replayedProps],
      ['predicted', predictedProps],
    ])('still looks the sent transaction up on other chains (%s)', async (_name, props) => {
      const requested = await create('1', props)

      expect(requested).toContain('eth_getTransactionByHash')
    })
  })
})
