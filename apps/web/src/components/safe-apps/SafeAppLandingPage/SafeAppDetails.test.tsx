import { faker } from '@faker-js/faker'
import { render } from '@/tests/test-utils'
import * as useChains from '@/hooks/useChains'
import { chainBuilder } from '@/tests/builders/chains'
import type { SafeApp } from '@safe-global/store/gateway/AUTO_GENERATED/safe-apps'
import { SafeAppDetails } from './SafeAppDetails'

describe('SafeAppDetails', () => {
  const chains = Array.from({ length: 7 }, () =>
    chainBuilder()
      .with({ chainId: faker.string.numeric(8) })
      .build(),
  )

  const app: SafeApp = {
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

  beforeEach(() => {
    jest.spyOn(useChains, 'default').mockReturnValue({ configs: chains } as ReturnType<typeof useChains.default>)
    jest.spyOn(useChains, 'useChain').mockImplementation((id) => chains.find((c) => c.chainId === id))
  })

  it('shows the network count in the label and renders every network', () => {
    const { getByText, getAllByTestId } = render(<SafeAppDetails app={app} showDefaultListWarning={false} />)

    expect(getByText('Available networks (7)')).toBeInTheDocument()
    expect(getAllByTestId('chain-logo')).toHaveLength(7)
  })
})
