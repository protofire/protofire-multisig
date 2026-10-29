import type { DisplayModel } from '@ethereum-sourcify/clear-signing'
import { ERC7730_REGISTRY_SOURCE_BLOB_BASE } from '@/config/constants.extra'
import { getDescriptorOwner, getDescriptorOwnerUrl, getDescriptorSourceUrl } from './descriptorModel'

describe('descriptorModel', () => {
  it('returns the metadata info url for the descriptor owner', () => {
    const model = { metadata: { owner: 'Velora', info: { url: 'https://www.velora.xyz/' } } } as DisplayModel

    expect(getDescriptorOwnerUrl(model)).toBe('https://www.velora.xyz/')
  })

  it('returns no owner url without an owner or with an invalid url', () => {
    expect(getDescriptorOwnerUrl({ metadata: { info: { url: 'https://velora.xyz' } } } as DisplayModel)).toBeUndefined()
    expect(
      getDescriptorOwnerUrl({ metadata: { owner: 'Velora', info: { url: 'nope' } } } as DisplayModel),
    ).toBeUndefined()
  })

  it.each(['javascript:alert(1)', 'data:text/html,<script>alert(1)</script>', 'http://velora.xyz'])(
    'returns no owner url for the non-https url %s',
    (url) => {
      expect(getDescriptorOwnerUrl({ metadata: { owner: 'Velora', info: { url } } } as DisplayModel)).toBeUndefined()
    },
  )

  it('hides the owner of Safe contract descriptors, which attribute them to a different wallet product', () => {
    const model = {
      metadata: { owner: 'Safe{Wallet}', info: { url: 'https://app.safe.global/welcome' } },
    } as DisplayModel

    expect(getDescriptorOwner(model, 'registry/safe/calldata-Safe-1.4.1.json')).toBeUndefined()
    expect(getDescriptorOwner(model, '/registry/safe/calldata-SafeL2-1.3.0.json')).toBeUndefined()
  })

  it('keeps the owner of every other descriptor', () => {
    const model = { metadata: { owner: 'Aave DAO' } } as DisplayModel

    expect(getDescriptorOwner(model, 'registry/aave/calldata-lpv3.json')).toBe('Aave DAO')
    expect(getDescriptorOwner(model, 'registry/safebox/calldata.json')).toBe('Aave DAO')
    expect(getDescriptorOwner(model, undefined)).toBe('Aave DAO')
  })

  it('builds the source url from the descriptor path', () => {
    expect(getDescriptorSourceUrl('/registry/velora/calldata.json')).toBe(
      `${ERC7730_REGISTRY_SOURCE_BLOB_BASE}/registry/velora/calldata.json`,
    )
    expect(getDescriptorSourceUrl(undefined)).toBeUndefined()
  })
})
