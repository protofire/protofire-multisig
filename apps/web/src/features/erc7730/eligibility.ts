import type { TransactionData } from '@safe-global/store/gateway/AUTO_GENERATED/transactions'
import { Operation } from '@safe-global/store/gateway/types'
import { sameAddress } from '@safe-global/utils/utils/addresses'
import { FEATURES } from '@safe-global/utils/utils/chains'
import { useHasFeature } from '@/hooks/useChains'
import useSafeAddress from '@/hooks/useSafeAddress'
import { isMultiSendCalldata } from '@/utils/transaction-calldata'

export const useClearSigningLookupEnabled = (): boolean => useHasFeature(FEATURES.ERC7730_CLEAR_SIGNING) ?? false

export const useIsClearSigningEligible = (txData: TransactionData | null | undefined): boolean => {
  const isEnabled = useClearSigningLookupEnabled()
  const safeAddress = useSafeAddress()
  const hexData = txData?.hexData ?? ''
  return (
    isEnabled &&
    txData?.operation !== Operation.DELEGATE &&
    // Safe self-calls target the proxy, while registry descriptors are keyed by the singleton address
    !sameAddress(txData?.to.value, safeAddress) &&
    !!hexData &&
    hexData !== '0x' &&
    !isMultiSendCalldata(hexData)
  )
}
