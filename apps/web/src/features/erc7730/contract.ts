import type { ClearSigningCheck, ClearSigningTypedDataReview } from './ClearSigningCheck'
import type { ClearSigningLookupButton } from './ClearSigningLookupButton'
import type { ClearSigningFoundChip, clearSigningAccordionClassName } from './ClearSigningPanel'

export interface Erc7730Contract {
  ClearSigningCheck: typeof ClearSigningCheck
  ClearSigningTypedDataReview: typeof ClearSigningTypedDataReview
  ClearSigningLookupButton: typeof ClearSigningLookupButton
  ClearSigningFoundChip: typeof ClearSigningFoundChip

  clearSigningAccordionClassName: typeof clearSigningAccordionClassName
}
