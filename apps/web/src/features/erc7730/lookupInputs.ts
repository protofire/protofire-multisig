import type { TypedData as ClearSigningTypedData, Transaction } from '@ethereum-sourcify/clear-signing'
import type { TypedData as GatewayTypedData } from '@safe-global/store/gateway/AUTO_GENERATED/messages'
import type { TransactionData } from '@safe-global/store/gateway/AUTO_GENERATED/transactions'
import { normalizeTypedData } from '@safe-global/utils/utils/web3'
import type { ClearSigningLookupEntry, ClearSigningLookupOutcome } from './ClearSigningLookupContext'

export const getClearSigningLookupKey = (chainId: string, txData: TransactionData): string =>
  `${chainId}:${txData.to.value}:${txData.operation}:${txData.value ?? '0'}:${txData.hexData ?? ''}`

export const getClearSigningTypedDataLookupKey = (chainId: string, typedData: ClearSigningTypedData): string =>
  `${chainId}:${typedData.account}:${typedData.domain.chainId}:${typedData.domain.verifyingContract ?? ''}:${typedData.primaryType}:${JSON.stringify(typedData.message)}`

const OUTCOME_LABELS: Record<ClearSigningLookupOutcome, string> = {
  found: 'Descriptor found',
  not_found: 'No descriptor',
  error: 'Lookup unavailable',
}

export const getClearSigningEntryLabel = (entry: ClearSigningLookupEntry): string | undefined => {
  if (entry.status === 'loading') {
    return 'Looking up…'
  }
  return entry.status === 'done' && entry.outcome ? OUTCOME_LABELS[entry.outcome] : undefined
}

export const getClearSigningLookupLabel = (
  txData: TransactionData,
  name: string | null | undefined = txData.addressInfoIndex?.[txData.to.value]?.name || txData.to.name,
): string => {
  const method = txData.dataDecoded?.method || 'Contract call'
  return name ? `${name}: ${method}` : method
}

export const getClearSigningFoundCountLabel = (foundCount: number): string =>
  foundCount > 0 ? `${foundCount} descriptor${foundCount === 1 ? '' : 's'} found` : 'No descriptors found'

export const toClearSigningTransaction = (chainId: string, from: string, txData: TransactionData): Transaction => ({
  chainId: Number(chainId),
  from,
  to: txData.to.value,
  data: txData.hexData ?? '',
  value: txData.value ? BigInt(txData.value) : undefined,
})

export const toClearSigningTypedData = (account: string, message: GatewayTypedData): ClearSigningTypedData => {
  const normalized = normalizeTypedData(message)
  const { EIP712Domain: _domainType, ...types } = normalized.types

  return {
    account,
    domain: normalized.domain,
    primaryType: normalized.primaryType,
    types,
    message: normalized.message,
  }
}
