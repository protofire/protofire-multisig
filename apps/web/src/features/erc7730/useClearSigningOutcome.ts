import type { TransactionData } from '@safe-global/store/gateway/AUTO_GENERATED/transactions'
import useChainId from '@/hooks/useChainId'
import { useClearSigningLookupContext, type ClearSigningLookupOutcome } from './ClearSigningLookupContext'
import { getClearSigningLookupKey } from './lookupInputs'

export const useClearSigningOutcome = (txData: TransactionData): ClearSigningLookupOutcome | undefined => {
  const chainId = useChainId()
  const lookupContext = useClearSigningLookupContext()
  return lookupContext?.entries[getClearSigningLookupKey(chainId, txData)]?.outcome
}
