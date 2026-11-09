import type { Meta, StoryObj } from '@storybook/react'
import { Paper } from '@mui/material'
import { CheckStatus } from '@safe-global/utils/features/safenet-checks/types/status'
import SafenetCheckStatus from './SafenetCheckStatus'

const meta: Meta<typeof SafenetCheckStatus> = {
  title: 'Features/SafenetChecks/SafenetCheckStatus',
  component: SafenetCheckStatus,
  parameters: { layout: 'centered' },
  decorators: [
    (Story) => (
      <Paper sx={{ p: 2, width: 520 }}>
        <Story />
      </Paper>
    ),
  ],
  args: {
    unavailableReason: undefined,
    isLoading: false,
    isStale: false,
    onRefresh: () => {},
  },
}

export default meta
type Story = StoryObj<typeof SafenetCheckStatus>

const withLink = { explorerUrl: 'https://safenet-explorer.eth.limo/#/safeTx?chainId=11155111&safeTxHash=0x1234' }

export const Loading: Story = { args: { status: CheckStatus.UNAVAILABLE } }
export const Submitted: Story = { args: { ...withLink, status: CheckStatus.SUBMITTED } }
export const InProgress: Story = { args: { ...withLink, status: CheckStatus.IN_PROGRESS } }
export const Verified: Story = { args: { ...withLink, status: CheckStatus.BENIGN } }
export const Denied: Story = { args: { ...withLink, status: CheckStatus.MALICIOUS } }
export const Disputed: Story = { args: { ...withLink, status: CheckStatus.DISPUTED } }
export const TimedOut: Story = { args: { ...withLink, status: CheckStatus.TIMED_OUT } }
export const NoCheck: Story = { args: { status: CheckStatus.UNAVAILABLE, unavailableReason: 'NO_CHECK' } }
export const NoCheckWithRequest: Story = {
  args: { status: CheckStatus.UNAVAILABLE, unavailableReason: 'NO_CHECK', onRequestCheck: () => {} },
}
export const Requested: Story = {
  args: {
    status: CheckStatus.UNAVAILABLE,
    unavailableReason: 'NO_CHECK',
    onRequestCheck: () => {},
    requestState: 'requested',
  },
}
export const RequestedReadFailed: Story = {
  args: {
    status: CheckStatus.UNAVAILABLE,
    unavailableReason: 'READ_FAILED',
    onRequestCheck: () => {},
    requestState: 'requested',
  },
}
export const ReadFailed: Story = {
  args: { status: CheckStatus.UNAVAILABLE, unavailableReason: 'READ_FAILED', isStale: true },
}
