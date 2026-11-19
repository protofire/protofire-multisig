import type { Meta, StoryObj } from '@storybook/react'
import DataMigrationBannerView from './DataMigrationBannerView'

const meta = {
  component: DataMigrationBannerView,
  title: 'Components/Common/DataMigrationBanner',
  tags: ['autodocs'],
  parameters: {
    componentSubtitle: 'Non-dismissible banner pointing Immutable Safe users to Protofire Multisig.',
  },
} satisfies Meta<typeof DataMigrationBannerView>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    href: 'https://app.safe.protofire.io/home?safe=imx:0x0000000000000000000000000000000000000001',
  },
}
