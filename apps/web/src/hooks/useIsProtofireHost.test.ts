import { isAllowedProtofireHost } from '@/hooks/useIsProtofireHost'

describe('isAllowedProtofireHost', () => {
  it('allows the Protofire shared-UI production, staging and dev hosts', () => {
    expect(isAllowedProtofireHost('app.safe.protofire.io')).toBe(true)
    expect(isAllowedProtofireHost('app.stage.safe.protofire.io')).toBe(true)
    expect(isAllowedProtofireHost('app.dev.safe.protofire.io')).toBe(true)
  })

  it('allows local development hosts', () => {
    expect(isAllowedProtofireHost('localhost:3000')).toBe(true)
    expect(isAllowedProtofireHost('localhost:4000')).toBe(true)
    expect(isAllowedProtofireHost('localhost:6006')).toBe(true)
  })

  it('rejects the redirected-from host and other Safe hosts', () => {
    expect(isAllowedProtofireHost('safe.optimism.io')).toBe(false)
    expect(isAllowedProtofireHost('app.safe.global')).toBe(false)
  })

  it('rejects dedicated partner deployments and look-alike subdomains', () => {
    expect(isAllowedProtofireHost('seismic.safe.protofire.io')).toBe(false)
    expect(isAllowedProtofireHost('app.safe.protofire.io.evil.com')).toBe(false)
    expect(isAllowedProtofireHost('evil-app.safe.protofire.io')).toBe(false)
  })
})
