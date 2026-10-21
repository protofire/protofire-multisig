import type { TransactionData } from '@safe-global/store/gateway/AUTO_GENERATED/transactions'
import useChainId from '@/hooks/useChainId'
import { useClearSigningLookupContext, type ClearSigningLookupEntry } from './ClearSigningLookupContext'
import { getClearSigningLookupKey } from './lookupInputs'

export type ClearSigningLookupOutcomeResult = Pick<ClearSigningLookupEntry, 'outcome' | 'attestation'>

export const useClearSigningOutcome = (txData: TransactionData): ClearSigningLookupOutcomeResult => {
  const chainId = useChainId()
  const lookupContext = useClearSigningLookupContext()
  const entry = lookupContext?.entries[getClearSigningLookupKey(chainId, txData)]
  return { outcome: entry?.outcome, attestation: entry?.attestation }
}
