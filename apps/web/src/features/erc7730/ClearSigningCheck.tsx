import type { TypedData } from '@safe-global/store/gateway/AUTO_GENERATED/messages'
import type { TransactionData } from '@safe-global/store/gateway/AUTO_GENERATED/transactions'
import { useMemo, type ReactElement } from 'react'
import useChainId from '@/hooks/useChainId'
import useSafeAddress from '@/hooks/useSafeAddress'
import { ClearSigningBoundary, ClearSigningLookupStatusView } from './ClearSigningStatus'
import { useClearSigningLookupEnabled, useIsClearSigningEligible } from './eligibility'
import {
  getClearSigningLookupKey,
  getClearSigningLookupLabel,
  getClearSigningTypedDataLookupKey,
  toClearSigningTransaction,
  toClearSigningTypedData,
} from './lookupInputs'
import { calldataInputAdapter, typedDataInputAdapter, useClearSigningLookup } from './useClearSigningLookup'

type ClearSigningCheckProps = {
  txData: TransactionData
  lookupLabel?: string
}

const ClearSigningCheckContent = ({ txData, lookupLabel }: ClearSigningCheckProps): ReactElement | null => {
  const chainId = useChainId()
  const safeAddress = useSafeAddress()
  const isEligible = useIsClearSigningEligible(txData)

  const lookup = useClearSigningLookup({
    lookupKey: getClearSigningLookupKey(chainId, txData),
    label: lookupLabel ?? getClearSigningLookupLabel(txData),
    isEligible,
    input: isEligible ? toClearSigningTransaction(chainId, safeAddress, txData) : undefined,
    adapter: calldataInputAdapter,
  })

  return <ClearSigningLookupStatusView lookup={lookup} subject="call" />
}

export const ClearSigningCheck = (props: ClearSigningCheckProps): ReactElement => (
  <ClearSigningBoundary subject="call">
    <ClearSigningCheckContent {...props} />
  </ClearSigningBoundary>
)

type ClearSigningTypedDataReviewProps = {
  account: string
  message: TypedData
}

const ClearSigningTypedDataReviewContent = ({
  account,
  message,
}: ClearSigningTypedDataReviewProps): ReactElement | null => {
  const chainId = useChainId()
  const isEligible = useClearSigningLookupEnabled()

  const typedData = useMemo(
    () => (isEligible ? toClearSigningTypedData(account, message) : undefined),
    [account, isEligible, message],
  )

  const lookup = useClearSigningLookup({
    lookupKey: typedData ? getClearSigningTypedDataLookupKey(chainId, typedData) : '',
    label: message.primaryType || 'Typed message',
    isEligible,
    input: typedData,
    adapter: typedDataInputAdapter,
  })

  return <ClearSigningLookupStatusView lookup={lookup} subject="message" />
}

export const ClearSigningTypedDataReview = (props: ClearSigningTypedDataReviewProps): ReactElement => (
  <ClearSigningBoundary subject="message">
    <ClearSigningTypedDataReviewContent {...props} />
  </ClearSigningBoundary>
)
