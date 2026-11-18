import type { Meta, StoryObj } from '@storybook/react'
import { Box } from '@mui/material'
import { ImplementationVersionState } from '@safe-global/store/gateway/types'
import { withMockProvider } from '@/storybook/preview'
import SafeHealthList from './components/SafeHealthList'
import { Undeployed } from './components/SafeHealthChecklist'
import { getOwnersCheck, getVersionCheck, type HealthCheck } from './services/checks'

const moduleAddress = '0x1234567890123456789012345678901234567890'

const allSet: HealthCheck[] = [
  getOwnersCheck(3, 2),
  getVersionCheck('1.4.1', '1.4.1', true, false, ImplementationVersionState.UP_TO_DATE),
  { id: 'modules', state: 'none', status: 'ok', title: 'Safe modules', summary: 'No Safe modules enabled' },
  { id: 'guard', state: 'none', status: 'ok', title: 'Transaction guard', summary: 'No transaction guard set' },
  { id: 'fallbackHandler', state: 'known', status: 'ok', title: 'Fallback handler', summary: 'Known handler' },
  { id: 'recovery', state: 'set_up', status: 'ok', title: 'Account recovery', summary: 'Set up' },
]

const mixed: HealthCheck[] = [
  getOwnersCheck(1, 1),
  getVersionCheck('1.3.0', '1.4.1', true, false, ImplementationVersionState.OUTDATED),
  {
    id: 'modules',
    state: 'listed',
    status: 'info',
    title: 'Safe modules',
    summary: '1 module enabled',
    items: [{ value: moduleAddress, name: 'Example module' }],
  },
  { id: 'guard', state: 'none', status: 'ok', title: 'Transaction guard', summary: 'No transaction guard set' },
  { id: 'fallbackHandler', state: 'known', status: 'ok', title: 'Fallback handler', summary: 'Known handler' },
  {
    id: 'recovery',
    state: 'not_available',
    status: 'info',
    title: 'Account recovery',
    summary: 'Not available on this network',
  },
]

const meta = {
  title: 'Features/SafeHealth',
  component: SafeHealthList,
  decorators: [
    withMockProvider(),
    (Story) => (
      <Box maxWidth={600}>
        <Story />
      </Box>
    ),
  ],
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
} satisfies Meta<typeof SafeHealthList>

export default meta
type Story = StoryObj<typeof meta>

export const HomeMixed: Story = { args: { checks: mixed, variant: 'home' } }

export const HomeAllSet: Story = { args: { checks: allSet, variant: 'home' } }

export const SettingsMixed: Story = { args: { checks: mixed, variant: 'settings' } }

export const UndeployedHome: Story = {
  args: { checks: [], variant: 'home' },
  render: () => <Undeployed variant="home" />,
}
