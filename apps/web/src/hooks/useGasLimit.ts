import { useEffect } from 'react'
import type { Eip1193Provider } from 'ethers'
import type { SafeTransaction } from '@safe-global/types-kit'
import useAsync from '@safe-global/utils/hooks/useAsync'
import useChainId from '@/hooks/useChainId'
import { useWeb3ReadOnly } from '@/hooks/wallets/web3ReadOnly'
import chains from '@/config/chains'
import { useLoadFeature } from '@/features/__core__'
import { OasisSignedEthCallFeature, useIsOasisSignedEthCallEnabled } from '@/features/oasis-signed-eth-call'
import { useSigner } from './wallets/useWallet'
import type { SignerWallet } from '@/components/common/WalletProvider'
import { useSafeSDK } from './coreSDK/safeCoreSDK'
import useIsSafeOwner from './useIsSafeOwner'
import { Errors, logError } from '@/services/exceptions'
import useSafeInfo from './useSafeInfo'
import {
  getEncodedSafeTx,
  GasMultipliers,
  incrementByGasMultiplier,
  getGasLimitForZkSync as getGasLimitForZkSyncUtil,
} from '@safe-global/utils/hooks/coreSDK/gasLimitUtils'
import { isTronChain } from '@/utils/tron'
import { isSmartContractWallet } from '@/utils/wallets'

/**
 * Display-only gas limit (energy units) for Tron Safe execTransaction-class
 * calls. Tron /jsonrpc does not support reliable eth_estimateGas, so we use
 * a constant tuned to typical Safe owner-management ops (addOwnerWithThreshold,
 * swapOwner, changeThreshold) which consume ~20-25k energy. Combined with
 * the 100 sun/energy display price in useGasPrice this renders ~2.5 TRX,
 * matching the TronLink signing popup within a small upper-bound margin
 * (BUG-07 / GSD-12881 — previous 50_000 yielded an over-estimate).
 * Real energy consumption is computed and burned at execution time by
 * the Tron transport via triggerConstantContract; this constant is purely a
 * pre-sign UI hint.
 */
const TRON_DEFAULT_GAS_LIMIT = 25_000n

// Sapphire derives msg.sender from an ECDSA signature, so a contract wallet (e.g. a nested Safe) cannot sign the call
const canSignOasisCall = async (wallet: SignerWallet, chainId: string): Promise<boolean> =>
  !wallet.isSafe && !(await isSmartContractWallet(chainId, wallet.address))

const useGasLimit = (
  safeTx?: SafeTransaction,
): {
  gasLimit?: bigint
  gasLimitError?: Error
  gasLimitLoading: boolean
} => {
  const safeSDK = useSafeSDK()
  const web3ReadOnly = useWeb3ReadOnly()
  const { safe } = useSafeInfo()
  const safeAddress = safe.address.value
  const threshold = safe.threshold
  const wallet = useSigner()
  const walletAddress = wallet?.address
  const isOwner = useIsSafeOwner()
  const currentChainId = useChainId()
  const hasSafeTxGas = !!safeTx?.data?.safeTxGas
  const isSignedEthCallEnabled = useIsOasisSignedEthCallEnabled()
  const oasisSignedEthCall = useLoadFeature(OasisSignedEthCallFeature)
  // Depend on the function, not the feature handle: the handle's meta is recreated every render, which would re-run the effect and re-prompt the signature
  const validateOasisSignedCall = oasisSignedEthCall.$isReady ? oasisSignedEthCall.validateOasisSignedCall : undefined

  const [gasLimit, gasLimitError, gasLimitLoading] = useAsync<bigint | undefined>(async () => {
    if (!safeAddress || !walletAddress || !safeSDK || !web3ReadOnly || !safeTx) return

    const encodedSafeTx = getEncodedSafeTx(
      safeSDK,
      safeTx,
      isOwner ? walletAddress : undefined,
      safeTx.signatures.size < threshold,
    )

    // if we are dealing with zksync and the walletAddress is a Safe, we have to do some magic
    // FIXME a new check to indicate ZKsync chain will be added to the config service and available under Chain
    if (
      (safe.chainId === chains.zksync || safe.chainId === chains.lens) &&
      (await web3ReadOnly.getCode(walletAddress)) !== '0x'
    ) {
      return getGasLimitForZkSyncUtil(web3ReadOnly, safeSDK, safeTx, safe.chainId, safe.address.value)
    }

    return web3ReadOnly
      .estimateGas({
        to: safeAddress,
        from: walletAddress,
        data: encodedSafeTx,
      })
      .then(async (estimatedGasLimit) => {
        // Due to a bug in Nethermind estimation, we need to increment the gasLimit by 30%
        // when the safeTxGas is defined and not 0. Currently Nethermind is used only for Gnosis Chain.
        const adjustedGasLimit =
          currentChainId === chains.gno && hasSafeTxGas
            ? incrementByGasMultiplier(estimatedGasLimit, GasMultipliers[chains.gno])
            : estimatedGasLimit

        // Oasis Sapphire: eth_estimateGas hides reverts, so validate with a signed eth_call instead
        if (
          encodedSafeTx &&
          isSignedEthCallEnabled &&
          wallet?.provider &&
          isOwner &&
          safeTx.signatures.size >= threshold - 1 &&
          (await canSignOasisCall(wallet, safe.chainId))
        ) {
          if (!validateOasisSignedCall) return undefined

          await validateOasisSignedCall(
            web3ReadOnly,
            wallet.provider as Eip1193Provider,
            { from: walletAddress, to: safeAddress, data: encodedSafeTx, gasLimit: adjustedGasLimit },
            Number(safe.chainId),
          )
        }

        return adjustedGasLimit
      })
      .catch((error) => {
        if (isTronChain(currentChainId)) {
          logError(Errors._612, error)
          return TRON_DEFAULT_GAS_LIMIT
        }
        throw error
      })
  }, [
    safeAddress,
    walletAddress,
    safeSDK,
    web3ReadOnly,
    safeTx,
    isOwner,
    currentChainId,
    hasSafeTxGas,
    threshold,
    safe,
    wallet,
    isSignedEthCallEnabled,
    validateOasisSignedCall,
  ])

  useEffect(() => {
    if (gasLimitError) {
      logError(Errors._612, gasLimitError.message)
    }
  }, [gasLimitError])

  return { gasLimit, gasLimitError, gasLimitLoading }
}

export default useGasLimit
