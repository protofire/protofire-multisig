import type { Meta, StoryObj } from '@storybook/react'
import { mswLoader } from 'msw-storybook-addon'
import type { SafeApp } from '@safe-global/store/gateway/AUTO_GENERATED/safe-apps'
import { createMockStory } from '@/stories/mocks'
import SafeAppPreviewDrawer from './index'

const setup = createMockStory({ scenario: 'efSafe', wallet: 'disconnected', layout: 'none' })

const createSafeApp = (chainCount: number): SafeApp => ({
  id: 1,
  url: 'https://example.com',
  name: 'Example app',
  iconUrl: '',
  description: 'An example Safe App available on a configurable number of networks.',
  chainIds: Array.from({ length: chainCount }, (_, index) => `${index + 1}`),
  tags: ['dashboard'],
  features: [],
  socialProfiles: [],
  featured: false,
  accessControl: { type: 'NO_RESTRICTIONS' },
})

const meta = {
  title: 'Components/SafeApps/SafeAppPreviewDrawer',
  component: SafeAppPreviewDrawer,
  loaders: [mswLoader],
  parameters: { layout: 'fullscreen', ...setup.parameters },
  decorators: [setup.decorator],
  tags: ['autodocs'],
  args: { isOpen: true, onClose: () => {} },
} satisfies Meta<typeof SafeAppPreviewDrawer>

export default meta
type Story = StoryObj<typeof meta>

export const FewNetworks: Story = { args: { safeApp: createSafeApp(3) } }

export const ManyNetworks: Story = { args: { safeApp: createSafeApp(40) } }
