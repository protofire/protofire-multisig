import type { Meta, StoryObj } from '@storybook/react'
import { withMockProvider } from '@/storybook/preview'
import HederaTxIdRow from './HederaTxIdRow'
import EvmTxIdRow from './EvmTxIdRow'

const meta = {
  title: 'Components/Transactions/TransactionIdentifierRow',
  component: EvmTxIdRow,
  decorators: [withMockProvider()],
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
  args: {
    txHash: '0x96a96c11b8d013ff5d7a6ce960b22e961046cfa42eff422ac71c1daf6adef2e0',
  },
} satisfies Meta<typeof EvmTxIdRow>

export default meta
type Story = StoryObj<typeof meta>

export const EvmTransactionHash: Story = {}

export const HederaTransactionId: Story = {
  render: () => (
    <HederaTxIdRow
      transactionId="0.0.10822511-1787674970-069053976"
      explorerLink={{
        href: 'https://hashscan.io/mainnet/transaction/0.0.10822511-1787674970-069053976',
        title: 'View on hashscan.io',
      }}
    />
  ),
}
