import { faker } from '@faker-js/faker'
import { render } from '@/tests/test-utils'
import * as useChains from '@/hooks/useChains'
import { chainBuilder } from '@/tests/builders/chains'
import type { SafeApp } from '@safe-global/store/gateway/AUTO_GENERATED/safe-apps'
import SafeAppPreviewDrawer from './index'

const chains = Array.from({ length: 18 }, () =>
  chainBuilder()
    .with({ chainId: faker.string.numeric(8) })
    .build(),
)

const safeApp: SafeApp = {
  id: faker.number.int(),
  url: faker.internet.url(),
  name: faker.company.name(),
  iconUrl: null,
  description: faker.lorem.sentence(),
  chainIds: chains.map((chain) => chain.chainId),
  accessControl: { type: 'NO_RESTRICTIONS' },
  tags: [],
  features: [],
  socialProfiles: [],
  featured: false,
}

describe('SafeAppPreviewDrawer', () => {
  beforeEach(() => {
    jest.spyOn(useChains, 'default').mockReturnValue({ configs: chains } as ReturnType<typeof useChains.default>)
    jest.spyOn(useChains, 'useChain').mockImplementation((id) => chains.find((c) => c.chainId === id))
  })

  it('shows the network count in the label and renders every network', () => {
    const { getByText, getAllByTestId } = render(<SafeAppPreviewDrawer safeApp={safeApp} isOpen onClose={jest.fn()} />)

    expect(getByText('Available networks (18)')).toBeInTheDocument()
    expect(getAllByTestId('chain-logo')).toHaveLength(18)
  })

  it('renders the open app button in the footer, outside the scrollable content', () => {
    const { getByTestId } = render(<SafeAppPreviewDrawer safeApp={safeApp} isOpen onClose={jest.fn()} />)

    const button = getByTestId('open-safe-app-btn')
    expect(button.closest('[class*="drawerFooter"]')).not.toBeNull()
    expect(button.closest('[class*="drawerContent"]')).toBeNull()
  })
})
