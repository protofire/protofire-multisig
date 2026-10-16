import type { SafeTransaction, SafeTransactionDataPartial } from '@safe-global/types-kit'
import { GATEWAY_URL } from '@/config/gateway'
import { sameAddress } from '@safe-global/utils/utils/addresses'

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

export type GasToken = { address: string; symbol: string; decimals: number }

export type FeePreview = {
  txData: {
    safeTxGas: string
    baseGas: string
    gasPrice: string
    gasToken: string
    refundReceiver: string
    numberSignatures: number
  }
  relayCost: { fiatCode: string; fiatValue: string }
}

/** Asks the gateway for the fee fields that make the Safe refund the relayer in `gasToken`. */
export const fetchFeePreview = async (args: {
  chainId: string
  safeAddress: string
  tx: Pick<SafeTransactionDataPartial, 'to' | 'value' | 'data' | 'operation'>
  gasToken: string
  numberSignatures: number
}): Promise<FeePreview> => {
  const response = await fetch(`${GATEWAY_URL}/v1/chains/${args.chainId}/fees/${args.safeAddress}/preview`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to: args.tx.to,
      value: args.tx.value ?? '0',
      data: args.tx.data ?? '0x',
      operation: args.tx.operation ?? 0,
      gasToken: args.gasToken,
      numberSignatures: args.numberSignatures,
    }),
  })
  if (!response.ok) {
    const body = await response.json().catch(() => undefined)
    throw new Error(body?.message ?? `Fee preview failed with status ${response.status}`)
  }
  return response.json()
}

/** The fee fields of a preview, ready to be merged into the transaction before it is signed. */
export const feeFields = (
  preview: FeePreview,
): Pick<SafeTransactionDataPartial, 'safeTxGas' | 'baseGas' | 'gasPrice' | 'gasToken' | 'refundReceiver'> => ({
  safeTxGas: preview.txData.safeTxGas,
  baseGas: preview.txData.baseGas,
  gasPrice: preview.txData.gasPrice,
  gasToken: preview.txData.gasToken,
  refundReceiver: preview.txData.refundReceiver,
})

export const NO_FEE_FIELDS = {
  safeTxGas: '0',
  baseGas: '0',
  gasPrice: '0',
  gasToken: ZERO_ADDRESS,
  refundReceiver: ZERO_ADDRESS,
} as const

/** Fee estimate from the signed gas budget; the contract refunds measured inner gas plus baseGas. */
export const getEstimatedFee = (preview: {
  txData: Pick<FeePreview['txData'], 'safeTxGas' | 'baseGas' | 'gasPrice'>
}): bigint => (BigInt(preview.txData.safeTxGas) + BigInt(preview.txData.baseGas)) * BigInt(preview.txData.gasPrice)

/** The gateway lists the chain's native coin as a gas token with the zero address. */
export const isNativeGasToken = (token: Pick<GasToken, 'address'>): boolean => sameAddress(token.address, ZERO_ADDRESS)

/**
 * True when the Safe itself pays the executor (non-zero gasPrice). A native fee has gasToken 0x0, so it
 * also needs a refundReceiver: with refundReceiver 0x0 the contract refunds tx.origin, which is not a relay fee.
 */
export const isSafePaysTx = (safeTx?: SafeTransaction): boolean =>
  !!safeTx &&
  BigInt(safeTx.data.gasPrice) > 0n &&
  (safeTx.data.gasToken !== ZERO_ADDRESS || safeTx.data.refundReceiver !== ZERO_ADDRESS)

export type GasTokenSupport = {
  gasTokens: GasToken[]
  refundReceiver: string | null
}

export const fetchGasTokenSupport = async (chainId: string): Promise<GasTokenSupport> => {
  const response = await fetch(`${GATEWAY_URL}/v1/chains/${chainId}/fees`)
  if (!response.ok) throw new Error(`Fee availability failed with status ${response.status}`)
  return response.json()
}

export const isGasTokenRelayTx = (
  safeTx: SafeTransaction | undefined,
  token: GasToken | undefined,
  refundReceiver: string | null | undefined,
): boolean =>
  !!(
    safeTx &&
    token &&
    refundReceiver &&
    isSafePaysTx(safeTx) &&
    sameAddress(safeTx.data.gasToken, token.address) &&
    sameAddress(safeTx.data.refundReceiver, refundReceiver)
  )
