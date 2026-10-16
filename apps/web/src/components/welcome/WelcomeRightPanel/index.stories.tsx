import type { Meta, StoryObj } from '@storybook/react'
import { mswLoader } from 'msw-storybook-addon'
import { createMockStory } from '@/stories/mocks'
import WelcomeRightPanel from './index'

const defaultSetup = createMockStory({
  scenario: 'efSafe',
  wallet: 'disconnected',
  layout: 'none',
})

const meta = {
  title: 'Components/Welcome/WelcomeRightPanel',
  component: WelcomeRightPanel,
  loaders: [mswLoader],
  parameters: {
    layout: 'fullscreen',
    ...defaultSetup.parameters,
  },
  decorators: [
    (Story) => (
      <div style={{ width: '50vw', minHeight: '100vh', marginLeft: 'auto' }}>
        <Story />
      </div>
    ),
    defaultSetup.decorator,
  ],
  tags: ['autodocs'],
} satisfies Meta<typeof WelcomeRightPanel>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
