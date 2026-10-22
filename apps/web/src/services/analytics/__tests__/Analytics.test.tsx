import { render, waitFor } from '@testing-library/react'
import Analytics from '../Analytics'
import { getGaCookieExpiresSeconds } from '../gaCookieExpires'

type DataLayerWindow = Window & { dataLayer?: IArguments[] }

const getCommands = () => ((window as DataLayerWindow).dataLayer ?? []).map((args) => Array.from(args))

describe('Analytics', () => {
  beforeEach(() => {
    delete (window as DataLayerWindow).dataLayer
    document.head.innerHTML = ''
    document.body.innerHTML = ''
    performance.mark = jest.fn()
  })

  it('sets GA cookie expiration before GA is configured', async () => {
    render(<Analytics />)

    await waitFor(() => expect(getCommands().some(([command]) => command === 'config')).toBe(true))

    const commands = getCommands()
    const setIndex = commands.findIndex(([command]) => command === 'set')
    const configIndex = commands.findIndex(([command]) => command === 'config')

    expect(commands[setIndex]).toEqual(['set', { cookie_expires: getGaCookieExpiresSeconds() }])
    expect(setIndex).toBeGreaterThanOrEqual(0)
    expect(setIndex).toBeLessThan(configIndex)
  })
})
