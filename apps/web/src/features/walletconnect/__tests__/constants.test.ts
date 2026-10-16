import { getSafeWalletMetadata, getWalletIcon } from '../constants'

describe('getSafeWalletMetadata', () => {
  it('should use the current app origin for url and icon', () => {
    const metadata = getSafeWalletMetadata()

    expect(metadata.url).toBe(window.location.origin)
    expect(metadata.icons).toEqual([`${window.location.origin}/images/logo-round.svg`])
    expect(metadata.description).toBe('Smart contract wallet')
  })

  it('should resolve the icon against the given origin', () => {
    expect(getWalletIcon('https://wallet.example.com')).toBe('https://wallet.example.com/images/logo-round.svg')
  })
})
