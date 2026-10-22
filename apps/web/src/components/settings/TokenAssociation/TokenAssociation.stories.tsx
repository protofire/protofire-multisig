import type { Meta, StoryObj } from '@storybook/react'
import { http, HttpResponse } from 'msw'
import { mswLoader } from 'msw-storybook-addon'
import { createMockStory, createChainData } from '@/stories/mocks'
import { chainFixtures } from '../../../../../../config/test/msw/fixtures'
import { TokenAssociation } from './index'

const hederaChainData = createChainData({}, { ...chainFixtures.mainnet, chainId: '295', shortName: 'hedera' })

// Empty by default — AssociatedTokensTable renders nothing until a story overrides this.
const mirrorNodeTokensHandler = http.get(/mirrornode\.hedera\.com\/api\/v1\/accounts\/.+\/tokens$/, () =>
  HttpResponse.json({ tokens: [], links: { next: null } }),
)

const hederaHandlers = [
  http.get(/\/v1\/chains\/\d+$/, () => HttpResponse.json(hederaChainData)),
  http.get(/\/v1\/chains$/, () => HttpResponse.json({ ...chainFixtures.all, results: [hederaChainData] })),
  mirrorNodeTokensHandler,
]

const defaultSetup = createMockStory({
  scenario: 'efSafe',
  wallet: 'owner',
  layout: 'paper',
  handlers: hederaHandlers,
})

const meta = {
  title: 'Settings/TokenAssociation',
  component: TokenAssociation,
  loaders: [mswLoader],
  parameters: {
    layout: 'padded',
    ...defaultSetup.parameters,
  },
  decorators: [defaultSetup.decorator],
} satisfies Meta<typeof TokenAssociation>

export default meta
type Story = StoryObj<typeof meta>

/**
 * On a Hedera chain, the section is shown with an "Associate Token" action.
 */
export const Default: Story = {}

/**
 * On a non-Hedera chain, the section renders nothing at all.
 */
export const NonHederaChain: Story = (() => {
  const setup = createMockStory({ scenario: 'efSafe', wallet: 'owner', layout: 'paper' })
  return {
    parameters: { ...setup.parameters },
    decorators: [setup.decorator],
  }
})()

/**
 * With tokens already associated, they're listed in a table below the "Associate Token" action.
 */
export const WithAssociatedTokens: Story = (() => {
  const setup = createMockStory({
    scenario: 'efSafe',
    wallet: 'owner',
    layout: 'paper',
    handlers: [
      http.get(/\/v1\/chains\/\d+$/, () => HttpResponse.json(hederaChainData)),
      http.get(/\/v1\/chains$/, () => HttpResponse.json({ ...chainFixtures.all, results: [hederaChainData] })),
      http.get(/mirrornode\.hedera\.com\/api\/v1\/accounts\/.+\/tokens$/, () =>
        HttpResponse.json({
          tokens: [
            {
              automatic_association: false,
              balance: 0,
              created_timestamp: `${Math.floor(Date.now() / 1000) - 60}.0`,
              decimals: 6,
              token_id: '0.0.731861',
              freeze_status: 'NOT_APPLICABLE',
              kyc_status: 'NOT_APPLICABLE',
            },
          ],
          links: { next: null },
        }),
      ),
    ],
  })
  return {
    parameters: { ...setup.parameters },
    decorators: [setup.decorator],
  }
})()

/**
 * A token with a non-zero balance can't be dissociated yet (Hedera requires a zero balance
 * first) — its dissociate button is disabled with an explanatory tooltip.
 */
export const WithNonZeroBalanceToken: Story = (() => {
  const setup = createMockStory({
    scenario: 'efSafe',
    wallet: 'owner',
    layout: 'paper',
    handlers: [
      http.get(/\/v1\/chains\/\d+$/, () => HttpResponse.json(hederaChainData)),
      http.get(/\/v1\/chains$/, () => HttpResponse.json({ ...chainFixtures.all, results: [hederaChainData] })),
      http.get(/mirrornode\.hedera\.com\/api\/v1\/accounts\/.+\/tokens$/, () =>
        HttpResponse.json({
          tokens: [
            {
              automatic_association: false,
              balance: 1000,
              created_timestamp: `${Math.floor(Date.now() / 1000) - 60}.0`,
              decimals: 6,
              token_id: '0.0.731861',
              freeze_status: 'NOT_APPLICABLE',
              kyc_status: 'NOT_APPLICABLE',
            },
          ],
          links: { next: null },
        }),
      ),
    ],
  })
  return {
    parameters: { ...setup.parameters },
    decorators: [setup.decorator],
  }
})()
