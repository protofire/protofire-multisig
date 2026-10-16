import { validateOasisSignedCall } from './services/signedEthCall'
import type { OasisSignedEthCallContract } from './contract'

const feature: OasisSignedEthCallContract = {
  validateOasisSignedCall,
}

export default feature
