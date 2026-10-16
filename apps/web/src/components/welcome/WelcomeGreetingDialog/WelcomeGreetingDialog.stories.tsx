import type { Meta, StoryObj } from '@storybook/react'
import { withMockProvider } from '@/storybook/preview'
import WelcomeGreetingDialog from './index'

const meta = {
  title: 'Components/Welcome/WelcomeGreetingDialog',
  component: WelcomeGreetingDialog,
  decorators: [withMockProvider()],
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
  args: { open: true, onClose: () => {} },
} satisfies Meta<typeof WelcomeGreetingDialog>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
