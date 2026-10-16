import type { Chain } from '@safe-global/store/gateway/AUTO_GENERATED/chains'
import type { SafeOverview } from '@safe-global/store/gateway/AUTO_GENERATED/safes'
import semverSatisfies from 'semver/functions/satisfies'
import memoize from 'lodash/memoize'
import { keccak256, ethers, solidityPacked, getAddress, getCreate2Address, type Provider } from 'ethers'
import type { SafeSetup } from '../types'

import {
  type UndeployedSafesState,
  type ReplayedSafeProps,
} from '@safe-global/utils/features/counterfactual/store/types'
import { sameAddress } from '@safe-global/utils/utils/addresses'
import { areOwnersMatching } from '@safe-global/utils/utils/safe-setup-comparison'
import { Safe_proxy_factory__factory } from '@safe-global/utils/types/contracts'
import { extractCounterfactualSafeSetup } from '@/features/counterfactual/services'
import { encodeSafeSetupCall } from '@/components/new-safe/create/logic'
import { type SafeItem } from '@/hooks/safes'
import { LATEST_SAFE_VERSION } from '@safe-global/utils/config/constants'
import { FEATURES, hasFeature } from '@safe-global/utils/utils/chains'
import { MIN_SAFE_VERSION_FOR_MULTICHAIN } from '../constants'
import { isTronChain } from '@/utils/tron'

// Re-export from shared hooks for backward compatibility
export { isMultiChainSafeItem } from '@/hooks/safes'

export const getSafeSetups = (
  safes: SafeItem[],
  safeOverviews: SafeOverview[],
  undeployedSafes: UndeployedSafesState,
): (SafeSetup | undefined)[] => {
  const safeSetups = safes.map((safeItem) => {
    const undeployedSafe = undeployedSafes?.[safeItem.chainId]?.[safeItem.address]
    if (undeployedSafe) {
      const counterfactualSetup = extractCounterfactualSafeSetup(undeployedSafe, safeItem.chainId)
      if (!counterfactualSetup) return undefined
      return {
        owners: counterfactualSetup.owners,
        threshold: counterfactualSetup.threshold,
        chainId: safeItem.chainId,
      }
    }
    const foundOverview = safeOverviews?.find(
      (overview) => overview.chainId === safeItem.chainId && sameAddress(overview.address.value, safeItem.address),
    )
    if (!foundOverview) return undefined
    return {
      owners: foundOverview.owners.map((owner) => owner.value),
      threshold: foundOverview.threshold,
      chainId: safeItem.chainId,
    }
  })
  return safeSetups
}

export const getSharedSetup = (safeSetups: (SafeSetup | undefined)[]): Omit<SafeSetup, 'chainId'> | undefined => {
  const comparisonSetup = safeSetups[0]

  if (!comparisonSetup) return undefined

  const allMatching = safeSetups.every(
    (setup) =>
      setup && areOwnersMatching(setup.owners, comparisonSetup.owners) && setup.threshold === comparisonSetup.threshold,
  )

  const { owners, threshold } = comparisonSetup
  return allMatching ? { owners, threshold } : undefined
}

export const getDeviatingSetups = (
  safeSetups: (SafeSetup | undefined)[],
  currentChainId: string | undefined,
): SafeSetup[] => {
  const currentSafeSetup = safeSetups.find((setup) => setup?.chainId === currentChainId)
  if (!currentChainId || !currentSafeSetup) return []

  const deviatingSetups = safeSetups
    .filter((setup): setup is SafeSetup => Boolean(setup))
    .filter((setup) => {
      return (
        setup &&
        (!areOwnersMatching(setup.owners, currentSafeSetup.owners) || setup.threshold !== currentSafeSetup.threshold)
      )
    })
  return deviatingSetups
}

const memoizedGetProxyCreationCode = memoize(
  async (factoryAddress: string, provider: Provider) => {
    return Safe_proxy_factory__factory.connect(factoryAddress, provider).proxyCreationCode()
  },
  async (factoryAddress, provider) => `${factoryAddress}${(await provider.getNetwork()).chainId}`,
)

/**
 * Tron CREATE2 formula differs from Ethereum:
 *   Ethereum: keccak256(0xff ++ factory_20bytes ++ salt ++ initCodeHash)[12:]
 *   Tron:     keccak256(factory_21bytes_with_41prefix ++ salt ++ initCodeHash)[12:]
 */
const getTronCreate2Address = (factoryAddress: string, salt: string, initCodeHash: string): string => {
  // Convert 0x-prefixed factory to 41-prefixed (21 bytes) for Tron CREATE2
  const factory41Hex = '0x41' + factoryAddress.slice(2)
  const create2Input = ethers.concat([factory41Hex, salt, initCodeHash])
  const hash = keccak256(create2Input)
  return getAddress(`0x${hash.slice(-40)}`)
}

export const predictSafeAddress = async (
  setupData: { initializer: string; saltNonce: string; singleton: string },
  factoryAddress: string,
  provider: Provider,
  chainId?: string,
) => {
  // Step 1: Hash the initializer
  const initializerHash = keccak256(setupData.initializer)

  // Step 2: Encode the initializerHash and saltNonce using abi.encodePacked equivalent
  const encoded = ethers.concat([initializerHash, solidityPacked(['uint256'], [setupData.saltNonce])])

  // Step 3: Hash the encoded value to get the final salt
  const salt = keccak256(encoded)

  // Get Proxy creation code
  const proxyCreationCode = await memoizedGetProxyCreationCode(factoryAddress, provider)

  const initCode = proxyCreationCode + solidityPacked(['uint256'], [setupData.singleton]).slice(2)
  const initCodeHash = keccak256(initCode)

  if (chainId && isTronChain(chainId)) {
    return getTronCreate2Address(factoryAddress, salt, initCodeHash)
  }

  return getCreate2Address(factoryAddress, salt, initCodeHash)
}

export const predictAddressBasedOnReplayData = async (
  safeCreationData: ReplayedSafeProps,
  provider: Provider,
  chainId?: string,
) => {
  const initializer = encodeSafeSetupCall(safeCreationData.safeAccountConfig)
  return predictSafeAddress(
    { initializer, saltNonce: safeCreationData.saltNonce, singleton: safeCreationData.masterCopy },
    safeCreationData.factoryAddress,
    provider,
    chainId,
  )
}

const canMultichain = (chain: Chain) => {
  return (
    hasFeature(chain, FEATURES.COUNTERFACTUAL) &&
    semverSatisfies(LATEST_SAFE_VERSION, `>=${MIN_SAFE_VERSION_FOR_MULTICHAIN}`)
  )
}

export const hasMultiChainCreationFeatures = (chain: Chain): boolean => {
  return hasFeature(chain, FEATURES.MULTI_CHAIN_SAFE_CREATION) && canMultichain(chain)
}

export const hasMultiChainAddNetworkFeature = (chain: Chain | undefined): boolean => {
  if (!chain) return false
  return hasFeature(chain, FEATURES.MULTI_CHAIN_SAFE_ADD_NETWORK) && canMultichain(chain)
}
