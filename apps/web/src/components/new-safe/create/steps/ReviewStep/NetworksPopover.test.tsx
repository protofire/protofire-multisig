import { faker } from '@faker-js/faker'
import userEvent from '@testing-library/user-event'
import { act, render, screen } from '@/tests/test-utils'
import * as useChains from '@/hooks/useChains'
import { chainBuilder } from '@/tests/builders/chains'
import NetworksPopover from './NetworksPopover'

describe('NetworksPopover', () => {
  const chains = Array.from({ length: 9 }, () =>
    chainBuilder()
      .with({ chainId: faker.string.numeric(8) })
      .build(),
  )

  beforeEach(() => {
    jest.useFakeTimers()
    jest.spyOn(useChains, 'default').mockReturnValue({ configs: chains } as ReturnType<typeof useChains.default>)
    jest.spyOn(useChains, 'useChain').mockImplementation((id) => chains.find((c) => c.chainId === id))
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('opens on hover and stays open while the pointer is over the popover', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
    render(
      <NetworksPopover networks={chains}>
        <span>logos</span>
      </NetworksPopover>,
    )

    expect(screen.queryByTestId('network-list-popover')).not.toBeInTheDocument()

    await user.hover(screen.getByTestId('network-list'))
    const popover = await screen.findByTestId('network-list-popover')
    expect(popover).toBeInTheDocument()

    await user.unhover(screen.getByTestId('network-list'))
    await user.hover(popover)
    act(() => {
      jest.advanceTimersByTime(500)
    })
    expect(screen.getByTestId('network-list-popover')).toBeInTheDocument()

    await user.unhover(popover)
    act(() => {
      jest.advanceTimersByTime(500)
    })
    expect(screen.queryByTestId('network-list-popover')).not.toBeInTheDocument()
  })

  it('lists every network name', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
    render(
      <NetworksPopover networks={chains}>
        <span>logos</span>
      </NetworksPopover>,
    )

    await user.hover(screen.getByTestId('network-list'))
    await screen.findByTestId('network-list-popover')

    chains.forEach((chain) => expect(screen.getByText(chain.chainName)).toBeInTheDocument())
  })

  it('opens on keyboard focus and closes on Escape', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
    render(
      <NetworksPopover networks={chains}>
        <span>logos</span>
      </NetworksPopover>,
    )

    await user.tab()
    expect(screen.getByTestId('network-list')).toHaveFocus()
    expect(await screen.findByTestId('network-list-popover')).toBeInTheDocument()

    await user.keyboard('{Escape}')
    expect(screen.queryByTestId('network-list-popover')).not.toBeInTheDocument()
  })
})
