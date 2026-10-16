import type { Meta, StoryObj } from '@storybook/react'
import SuperchainMigration from './index'
import { withMockProvider } from '@/storybook/preview'

const meta = {
  title: 'Components/SuperchainMigration',
  component: SuperchainMigration,
  parameters: {
    layout: 'fullscreen',
  },
  decorators: [withMockProvider()],
  tags: ['autodocs'],
} satisfies Meta<typeof SuperchainMigration>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}
