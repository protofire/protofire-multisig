import type { Erc7730Contract } from './contract'
import { ClearSigningCheck, ClearSigningTypedDataReview } from './ClearSigningCheck'
import { ClearSigningLookupButton } from './ClearSigningLookupButton'
import { ClearSigningFoundChip, clearSigningAccordionClassName } from './ClearSigningPanel'

const feature = {
  ClearSigningCheck,
  ClearSigningTypedDataReview,
  ClearSigningLookupButton,
  ClearSigningFoundChip,
  clearSigningAccordionClassName,
}

export default feature satisfies Erc7730Contract
