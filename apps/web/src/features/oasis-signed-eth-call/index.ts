import { createFeatureHandle } from '@/features/__core__'
import { FEATURES } from '@safe-global/utils/utils/chains'
import type { OasisSignedEthCallContract } from './contract'

// Only Oasis Sapphire chains list this flag in the config service, so the feature code loads only there
export const OasisSignedEthCallFeature = createFeatureHandle<OasisSignedEthCallContract>(
  'oasis-signed-eth-call',
  FEATURES.OASIS_SIGNED_ETH_CALL_GAS_ESTIMATION,
)

export type { OasisSignedEthCallContract } from './contract'
export { default as useIsOasisSignedEthCallEnabled } from './hooks/useIsOasisSignedEthCallEnabled'
