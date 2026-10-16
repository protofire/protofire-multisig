import type { Meta, StoryObj } from '@storybook/react'
import MigrationFallback from './index'

const meta = {
  title: 'Features/DataMigration/MigrationFallback',
  component: MigrationFallback,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof MigrationFallback>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}
