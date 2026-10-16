import type { validateOasisSignedCall } from './services/signedEthCall'

// Services are camelCase and stay undefined until the feature has loaded (check $isReady first)
export interface OasisSignedEthCallContract {
  validateOasisSignedCall: typeof validateOasisSignedCall
}
