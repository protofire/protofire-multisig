import Safe from '@safe-global/protocol-kit'
import { AbiCoder } from 'ethers'
import * as sdkStore from '@/hooks/coreSDK/safeCoreSDK'
import * as txSdk from '@/services/tx/tx-sender/sdk'
import * as contracts from '../safeContracts'
import { chainBuilder } from '@/tests/builders/chains'
import { ImplementationVersionState } from '@safe-global/store/gateway/types'
import { _getMinimumMultiSendCallOnlyVersion } from '../safeContracts'
import {
  isValidMasterCopy,
  _getValidatedGetContractProps,
  isMigrationToL2Possible,
} from '@safe-global/utils/services/contracts/safeContracts'
import { safeInfoBuilder } from '@/tests/builders/safe'

describe('safeContracts', () => {
  describe('isValidMasterCopy', () => {
    it('returns false if the implementation is unknown', async () => {
      const isValid = isValidMasterCopy(ImplementationVersionState.UNKNOWN)

      expect(isValid).toBe(false)
    })

    it('returns true if the implementation is up-to-date', async () => {
      const isValid = isValidMasterCopy(ImplementationVersionState.UP_TO_DATE)

      expect(isValid).toBe(true)
    })

    it('returns true if the implementation is outdated', async () => {
      const isValid = isValidMasterCopy(ImplementationVersionState.OUTDATED)

      expect(isValid).toBe(true)
    })
  })
  describe('getValidatedGetContractProps', () => {
    it('should return the correct props', () => {
      expect(_getValidatedGetContractProps('1.1.1')).toEqual({
        safeVersion: '1.1.1',
      })

      expect(_getValidatedGetContractProps('1.2.0')).toEqual({
        safeVersion: '1.2.0',
      })

      expect(_getValidatedGetContractProps('1.3.0')).toEqual({
        safeVersion: '1.3.0',
      })

      expect(_getValidatedGetContractProps('1.3.0+L2')).toEqual({
        safeVersion: '1.3.0',
      })
    })
    it.each(['728126428', '2494104990'])('uses the compatible ABI only on Tron %s', (chainId) => {
      expect(_getValidatedGetContractProps('1.5.0', chainId)).toEqual({ safeVersion: '1.4.1' })
      expect(_getValidatedGetContractProps('1.3.0', chainId)).toEqual({ safeVersion: '1.3.0' })
    })

    it.each(['1', '137', '3448148188', undefined])('does not broaden supported EVM versions on %s', (chainId) => {
      expect(() => _getValidatedGetContractProps('1.5.0', chainId)).toThrow('1.5.0 is not a valid Safe Account version')
    })

    it('should throw if the Safe version is invalid', () => {
      expect(() => _getValidatedGetContractProps('1.3.1')).toThrow('1.3.1 is not a valid Safe Account version')

      expect(() => _getValidatedGetContractProps('1.4.0')).toThrow('1.4.0 is not a valid Safe Account version')

      expect(() => _getValidatedGetContractProps('0.0.1')).toThrow('0.0.1 is not a valid Safe Account version')

      expect(() => _getValidatedGetContractProps('')).toThrow(' is not a valid Safe Account version')
    })
  })

  describe('_getMinimumMultiSendCallOnlyVersion', () => {
    it('should return the initial version if the Safe version is null', () => {
      expect(_getMinimumMultiSendCallOnlyVersion(null)).toBe('1.3.0')
    })

    it('should return the initial version if the Safe version is lower than the initial version', () => {
      expect(_getMinimumMultiSendCallOnlyVersion('1.0.0')).toBe('1.3.0')
    })

    it('should return the Safe version if the Safe version is higher than the initial version', () => {
      expect(_getMinimumMultiSendCallOnlyVersion('1.4.1')).toBe('1.4.1')
    })
  })

  describe('isMigrationToL2Possible', () => {
    it('should not be possible to migrate Safes on chains without migration lib', () => {
      expect(isMigrationToL2Possible(safeInfoBuilder().with({ nonce: 0, chainId: '69420' }).build())).toBeFalsy()
    })

    it('should not be possible to migrate Safes with nonce > 0', () => {
      expect(isMigrationToL2Possible(safeInfoBuilder().with({ nonce: 2, chainId: '10' }).build())).toBeFalsy()
    })

    it('should be possible to migrate Safes with nonce 0 on chains with migration lib', () => {
      expect(isMigrationToL2Possible(safeInfoBuilder().with({ nonce: 0, chainId: '10' }).build())).toBeTruthy()
    })
  })
})

// Exercise the UI boundaries with the real Protocol Kit and a local read-only RPC.
it.each(['728126428', '2494104990'])('loads UI contracts for deployed Tron 1.5.0 on %s', async (chainId) => {
  const address = '0x1111111111111111111111111111111111111111'
  const rpc = {
    request: async ({ method }: { method: string }) => {
      if (method === 'eth_chainId') return `0x${BigInt(chainId).toString(16)}`
      if (method === 'eth_accounts') return []
      if (method === 'eth_getCode') return '0x6000'
      if (method === 'eth_call') return AbiCoder.defaultAbiCoder().encode(['string'], ['1.5.0'])
      throw new Error(`Unexpected RPC method ${method}`)
    },
  }
  const sdk = await Safe.init({ provider: rpc, safeAddress: address, isL1SafeSingleton: false })
  const sdkSpy = jest.spyOn(sdkStore, 'getSafeSDK').mockReturnValue(sdk)
  const providerSpy = jest.spyOn(txSdk, 'getSafeProvider').mockReturnValue(sdk.getSafeProvider())
  try {
    const safe = safeInfoBuilder()
      .with({ chainId, version: '1.5.0', address: { value: address } })
      .build()
    const safeContract = await contracts.getReadOnlyCurrentGnosisSafeContract(safe)
    expect(safeContract.getAddress().toLowerCase()).toBe(address)
    const batch = await contracts.getReadOnlyMultiSendCallOnlyContract(safe.version, chainId)
    expect(batch.encode('multiSend', ['0x1234'])).toMatch(/^0x8d80ff0a/)
    const messages = await contracts.getReadOnlySignMessageLibContract(safe.version)
    expect(messages.encode('signMessage', ['0x1234'])).toMatch(/^0x85a5affe/)
    await expect(contracts.getReadOnlyProxyFactoryContract(safe.version)).resolves.toBeDefined()
    await expect(contracts.getReadOnlyFallbackHandlerContract(safe.version)).resolves.toBeDefined()
    await expect(
      contracts.getReadOnlyGnosisSafeContract(chainBuilder().with({ chainId, l2: true }).build(), safe.version),
    ).resolves.toBeDefined()
    expect(safe.version).toBe('1.5.0')
  } finally {
    sdkSpy.mockRestore()
    providerSpy.mockRestore()
  }
})
