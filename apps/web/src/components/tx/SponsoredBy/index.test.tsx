import { render } from '@/tests/test-utils'
import SponsoredBy, { RELAY_SPONSORS } from '.'

describe('SponsoredBy', () => {
  it('shows Protofire by default', () => {
    const { getByText, getByAltText } = render(<SponsoredBy chainId="84532" />)
    expect(getByText('Protofire')).toBeInTheDocument()
    expect(getByAltText('Protofire')).toHaveAttribute('src', '/images/protofire.svg')
  })

  it('has no Safe or Gnosis sponsor entries', () => {
    const names = Object.values(RELAY_SPONSORS).map((s) => s.name)
    expect(names).not.toContain('Safe')
    expect(names).not.toContain('Gnosis')
  })
})
