import type { Meta, StoryObj } from '@storybook/react'
import { Paper } from '@mui/material'
import { GasTokenFeeSummary } from './GasTokenFeeSummary'

const meta = {
  component: GasTokenFeeSummary,
  decorators: [
    (Story) => (
      <Paper sx={{ p: 2, maxWidth: 600 }}>
        <Story />
      </Paper>
    ),
  ],
  tags: ['autodocs'],
} satisfies Meta<typeof GasTokenFeeSummary>

export default meta
type Story = StoryObj<typeof meta>

export const USDC: Story = {
  args: {
    data: { safeTxGas: '39090', baseGas: '71500', gasPrice: '1' },
    token: { address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', symbol: 'USDC', decimals: 6 },
  },
}

export const DAI: Story = {
  args: {
    data: { safeTxGas: '39090', baseGas: '71500', gasPrice: '30000000000' },
    token: { address: '0x1111111111111111111111111111111111111111', symbol: 'DAI', decimals: 18 },
  },
}
