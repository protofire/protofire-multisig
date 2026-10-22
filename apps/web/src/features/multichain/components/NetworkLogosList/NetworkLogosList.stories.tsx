import type { Meta, StoryObj } from '@storybook/react'
import { Paper } from '@mui/material'
import NetworkLogosList from './index'
import { StoreDecorator } from '@/stories/storeDecorator'

const meta = {
  component: NetworkLogosList,
  parameters: {
    layout: 'centered',
  },
  decorators: [
    (Story) => (
      <StoreDecorator initialState={{}}>
        <Paper sx={{ padding: 2 }}>
          <Story />
        </Paper>
      </StoreDecorator>
    ),
  ],
  tags: ['autodocs'],
} satisfies Meta<typeof NetworkLogosList>

export default meta
type Story = StoryObj<typeof meta>

const createNetworks = (count: number) => Array.from({ length: count }, (_, index) => ({ chainId: `${index + 1}` }))

export const SingleNetwork: Story = {
  args: {
    networks: [{ chainId: '1' }],
  },
}

export const TwoNetworks: Story = {
  args: {
    networks: [{ chainId: '1' }, { chainId: '137' }],
  },
}

export const FourNetworks: Story = {
  args: {
    networks: [{ chainId: '1' }, { chainId: '137' }, { chainId: '10' }, { chainId: '42161' }],
  },
}

export const ManyNetworksWithHasMore: Story = {
  args: {
    networks: [
      { chainId: '1' },
      { chainId: '137' },
      { chainId: '10' },
      { chainId: '42161' },
      { chainId: '8453' },
      { chainId: '100' },
    ],
    showHasMore: true,
  },
}

export const ManyNetworksWithoutHasMore: Story = {
  args: {
    networks: [{ chainId: '1' }, { chainId: '137' }, { chainId: '10' }, { chainId: '42161' }, { chainId: '8453' }],
    showHasMore: false,
  },
}

export const ThreeNetworks: Story = {
  args: {
    networks: createNetworks(3),
  },
}

export const TenNetworks: Story = {
  args: {
    networks: createNetworks(10),
  },
}

export const FortyPlusNetworks: Story = {
  args: {
    networks: createNetworks(42),
  },
}

export const SuccessDialogVariant: Story = {
  args: {
    networks: createNetworks(42),
    logoSize: 28,
    maxHeight: 76,
    centered: true,
  },
}
