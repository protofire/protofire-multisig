import { FEATURES, hasFeature } from '../chains'

describe('chains', () => {
  describe('hasFeature with FEATURES.HEDERA', () => {
    it('should return true when the chain config lists HEDERA', () => {
      expect(hasFeature({ features: ['HEDERA'] }, FEATURES.HEDERA)).toBe(true)
    })

    it('should return false when the chain config does not list HEDERA', () => {
      expect(hasFeature({ features: ['ERC721'] }, FEATURES.HEDERA)).toBe(false)
    })
  })
})
