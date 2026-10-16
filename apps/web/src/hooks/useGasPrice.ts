import { useCallback } from 'react'
import useAsync, { type AsyncResult } from '@safe-global/utils/hooks/useAsync'
import { useCurrentChain } from './useChains'
import { useWeb3ReadOnly } from './wallets/web3'
import { useDefaultGasPrice, type GasFeeParams } from '@safe-global/utils/hooks/useDefaultGasPrice'
import useChainId from './useChainId'
import { isTronChain } from '@/utils/tron'
import { Errors, logError as logCodedError } from '@/services/exceptions'

// Tron's `eth_gasPrice` returns the network's fixed energy price, currently 100 sun.
// Used as a fallback when the RPC call fails (e.g. batched with an unsupported method).
const TRON_FALLBACK_GAS_PRICE = 100n

const useGasPrice = (isSpeedUp: boolean = false): AsyncResult<GasFeeParams> => {
  const chain = useCurrentChain()
  const provider = useWeb3ReadOnly()
  const chainId = useChainId()

  const logError = useCallback((e: string) => {
    console.error(e)
  }, [])

  const [gasPrice, gasPriceError, gasPriceLoading] = useDefaultGasPrice(chain, provider, {
    isSpeedUp,
    withPooling: true,
    logError,
  })

  // Tron: ethers' getFeeData() cannot parse Tron blocks, but `eth_gasPrice` on Tron's
  // JSON-RPC returns the current energy price in sun. Combined with the energy
  // estimate from useGasLimit this yields the real burn cost in TRX.
  const isTron = isTronChain(chainId)
  const [tronGasPrice, tronGasPriceError, tronGasPriceLoading] = useAsync<GasFeeParams | undefined>(async () => {
    if (!isTron || !provider) return
    try {
      const priceHex: string = await provider.send('eth_gasPrice', [])
      return { maxFeePerGas: BigInt(priceHex), maxPriorityFeePerGas: 0n } as GasFeeParams
    } catch (e) {
      // A batched call sharing the request (e.g. eth_getTransactionCount) can make
      // Tron's node fail the whole batch — fall back to the known energy price instead
      // of leaving the fee estimate stuck.
      logCodedError(Errors._611, e)
      return { maxFeePerGas: TRON_FALLBACK_GAS_PRICE, maxPriorityFeePerGas: 0n } as GasFeeParams
    }
  }, [isTron, provider])

  if (isTron) {
    return [tronGasPrice, tronGasPriceError, tronGasPriceLoading]
  }

  return [gasPrice, gasPriceError, gasPriceLoading]
}

export default useGasPrice
