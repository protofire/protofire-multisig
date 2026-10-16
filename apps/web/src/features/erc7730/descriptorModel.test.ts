import type { DisplayModel } from '@ethereum-sourcify/clear-signing'
import { ERC7730_REGISTRY_SOURCE_BLOB_BASE } from '@/config/constants.extra'
import { getDescriptorOwnerUrl, getDescriptorSourceUrl } from './descriptorModel'

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

  it('builds the source url from the descriptor path', () => {
    expect(getDescriptorSourceUrl('/registry/velora/calldata.json')).toBe(
      `${ERC7730_REGISTRY_SOURCE_BLOB_BASE}/registry/velora/calldata.json`,
    )
    expect(getDescriptorSourceUrl(undefined)).toBeUndefined()
  })
})
