import { useMemo, useState } from 'react'
import useAsync from '@safe-global/utils/hooks/useAsync'
import { asError } from '@safe-global/utils/services/exceptions/utils'
import { sameAddress } from '@safe-global/utils/utils/addresses'
import { multicall } from '@safe-global/utils/utils/multicall'
import { ERC20__factory } from '@safe-global/utils/types/contracts'
import type { SafeTransaction } from '@safe-global/types-kit'
import { useWeb3ReadOnly } from '@/hooks/wallets/web3'
import { decodeMultiSendData } from '@safe-global/protocol-kit/dist/src/utils'
import { isMultiSendCalldata } from '@/utils/transaction-calldata'
import { fetchFeePreview, getEstimatedFee, isNativeGasToken, type GasToken } from '@/services/tx/gasTokenFee'

const erc20 = ERC20__factory.createInterface()

type FeeTransaction = Pick<SafeTransaction['data'], 'to' | 'value' | 'data' | 'operation' | 'nonce'>

// Reserve explicit token transfers (or native value); the gateway still simulates full execution before relaying.
export const getFeeTokenSpend = (transaction: FeeTransaction, token: GasToken, safeAddress: string): bigint =>
  (isMultiSendCalldata(transaction.data) ? decodeMultiSendData(transaction.data) : [transaction]).reduce(
    (total, tx) => {
      if (isNativeGasToken(token)) return total + BigInt(tx.value || 0)
      if (!sameAddress(tx.to, token.address)) return total
      const call = erc20.parseTransaction({ data: tx.data ?? '0x' })
      if (call?.name === 'transfer' && !sameAddress(call.args[0], safeAddress)) return total + BigInt(call.args[1])
      if (
        call?.name === 'transferFrom' &&
        sameAddress(call.args[0], safeAddress) &&
        !sameAddress(call.args[1], safeAddress)
      ) {
        return total + BigInt(call.args[2])
      }
      return total
    },
    0n,
  )

export const useGasTokenFeeOptions = (
  tokens: GasToken[] | undefined,
  safeTx: SafeTransaction | undefined,
  chainId: string | undefined,
  safeAddress: string,
  threshold: number,
  historyTag: string | null | undefined,
) => {
  const provider = useWeb3ReadOnly()
  const [attempt, setAttempt] = useState(0)
  const { to, value, data, operation, nonce } = safeTx?.data ?? {}
  const tx = useMemo(
    () =>
      to !== undefined && value !== undefined && data !== undefined && operation !== undefined && nonce !== undefined
        ? { to, value, data, operation, nonce }
        : undefined,
    [to, value, data, operation, nonce],
  )
  const requestKey = JSON.stringify([chainId, safeAddress, tokens, tx, threshold, historyTag, attempt])
  const [result, error, loading] = useAsync(async () => {
    if (!tokens?.length || !tx || !chainId || !provider) return
    // The native coin has no balanceOf; read it from the node
    const erc20Tokens = tokens.filter((token) => !isNativeGasToken(token))
    const erc20Balances = erc20Tokens.length
      ? await multicall(
          provider,
          erc20Tokens.map((token) => ({
            to: token.address,
            data: erc20.encodeFunctionData('balanceOf', [safeAddress]),
          })),
        )
      : []
    const nativeBalance = tokens.some(isNativeGasToken)
      ? await provider.getBalance(safeAddress).then(
          (value) => ({ success: true, returnData: `0x${value.toString(16)}` }),
          () => ({ success: false, returnData: '0x' }),
        )
      : undefined
    const options = await Promise.all(
      tokens.map(async (token) => {
        let balance: bigint | undefined
        try {
          const loaded = isNativeGasToken(token) ? nativeBalance : erc20Balances[erc20Tokens.indexOf(token)]
          if (!loaded?.success) throw new Error(`Couldn’t load the ${token.symbol} balance.`)
          balance = BigInt(loaded.returnData)
          const spend = getFeeTokenSpend(tx, token, safeAddress)
          if (balance <= spend) return { token, balance, preview: undefined, insufficient: true, error: undefined }
          const preview = await fetchFeePreview({
            chainId,
            safeAddress,
            tx,
            gasToken: token.address,
            numberSignatures: threshold,
          })
          const insufficient = balance < spend + getEstimatedFee(preview)
          return { token, balance, preview, insufficient, error: undefined }
        } catch (cause) {
          return { token, balance, preview: undefined, insufficient: false, error: asError(cause) }
        }
      }),
    )
    return { requestKey, options }
  }, [requestKey, provider, tokens, tx, chainId, safeAddress, threshold])
  return {
    options: result?.requestKey === requestKey ? result.options : undefined,
    error,
    loading,
    retry: () => setAttempt((value) => value + 1),
  }
}
