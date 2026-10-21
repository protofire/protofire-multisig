import { createFeatureHandle } from '@/features/__core__'
import { FEATURES } from '@safe-global/utils/utils/chains'
import type { Erc7730Contract } from './contract'

export const Erc7730Feature = createFeatureHandle<Erc7730Contract>('erc7730', FEATURES.ERC7730_ERC8176_CLEAR_SIGNING)

export type { Erc7730Contract } from './contract'

export {
  ClearSigningLookupProvider,
  useClearSigningLookupContext,
  useClearSigningLookupSummary,
  type ClearSigningLookupSummary,
} from './ClearSigningLookupContext'
export { useClearSigningLookupEnabled } from './eligibility'
export { useClearSigningOutcome } from './useClearSigningOutcome'
export { getClearSigningEntryLabel } from './lookupInputs'
