import type { Meta, StoryObj } from '@storybook/react'
import { mswLoader } from 'msw-storybook-addon'
import { FormProvider, useForm } from 'react-hook-form'
import type { Chain } from '@safe-global/store/gateway/AUTO_GENERATED/chains'
import { createMockStory } from '@/stories/mocks'
import NetworkMultiSelectorInput from './NetworkMultiSelectorInput'

const setup = createMockStory({ scenario: 'efSafe', wallet: 'disconnected', layout: 'paper' })

const createChains = (count: number): Chain[] =>
  Array.from(
    { length: count },
    (_, index) =>
      ({
        chainId: `${index + 1}`,
        chainName: `Network ${index + 1}`,
        isTestnet: false,
      }) as Chain,
  )

const Wrapper = ({ count }: { count: number }) => {
  const methods = useForm<{ networks: Chain[] }>({ defaultValues: { networks: createChains(count) } })
  const networks = methods.watch('networks')

  return (
    <FormProvider {...methods}>
      <h5>Select networks ({networks.length})</h5>
      <NetworkMultiSelectorInput name="networks" value={networks} />
    </FormProvider>
  )
}

const meta = {
  title: 'Components/Common/NetworkMultiSelectorInput',
  component: Wrapper,
  loaders: [mswLoader],
  parameters: { layout: 'centered', ...setup.parameters },
  decorators: [setup.decorator],
  tags: ['autodocs'],
} satisfies Meta<typeof Wrapper>

export default meta
type Story = StoryObj<typeof meta>

export const FewSelected: Story = { args: { count: 3 } }

export const ManySelected: Story = { args: { count: 18 } }

export const FortyPlusSelected: Story = { args: { count: 42 } }
