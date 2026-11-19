import { faker } from '@faker-js/faker'
import { getProtofireMultisigSafeUrl, isDataMigrationBannerChain } from '../dataMigration'

describe('dataMigration config', () => {
  it('builds the Protofire Multisig URL for the open Safe', () => {
    const safeAddress = faker.finance.ethereumAddress()

    expect(getProtofireMultisigSafeUrl('imx', safeAddress)).toBe(
      `https://app.safe.protofire.io/home?safe=imx:${safeAddress}`,
    )
  })

  it.each([
    ['13371', true],
    ['13473', false],
    ['1', false],
  ])('chain %s shows the banner: %s', (chainId, expected) => {
    expect(isDataMigrationBannerChain(chainId)).toBe(expected)
  })
})
