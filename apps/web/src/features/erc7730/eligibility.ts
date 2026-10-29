import type { TransactionData } from '@safe-global/store/gateway/AUTO_GENERATED/transactions'
import { Operation } from '@safe-global/store/gateway/types'
import { FEATURES } from '@safe-global/utils/utils/chains'
import { useHasFeature } from '@/hooks/useChains'
import { isMultiSendCalldata } from '@/utils/transaction-calldata'

export const useClearSigningLookupEnabled = (): boolean =>
  useHasFeature(FEATURES.ERC7730_ERC8176_CLEAR_SIGNING) ?? false

export const useIsClearSigningEligible = (txData: TransactionData | null | undefined): boolean => {
  const isEnabled = useClearSigningLookupEnabled()
  const hexData = txData?.hexData ?? ''
  return (
    isEnabled &&
    txData?.operation !== Operation.DELEGATE &&
    !!hexData &&
    hexData !== '0x' &&
    !isMultiSendCalldata(hexData)
  )
}
