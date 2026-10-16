import { fireEvent, screen } from '@testing-library/react'
import { render } from '@/tests/test-utils'
import { GasTokenFeeSummary } from '../GasTokenFeeSummary'

it('shows the token charge and an explanation accessible by click and keyboard', async () => {
  render(
    <GasTokenFeeSummary
      data={{ safeTxGas: '39090', baseGas: '71500', gasPrice: '1' }}
      token={{ address: '0x1111111111111111111111111111111111111111', symbol: 'USDC', decimals: 6 }}
    />,
  )
  expect(screen.getByText('≈ 0.11059 USDC')).toBeInTheDocument()
  expect(screen.queryByText('Free')).not.toBeInTheDocument()
  const info = screen.getByRole('button', { name: 'How transaction fees are paid' })
  fireEvent.click(info)
  expect(await screen.findByRole('tooltip')).toHaveTextContent('The final charge may differ.')
  fireEvent.keyDown(info, { key: 'Escape' })
})

it('labels a native fee as a maximum in the native symbol and decimals', () => {
  render(
    <GasTokenFeeSummary
      data={{ safeTxGas: '39090', baseGas: '71500', gasPrice: '1000000000' }}
      token={{ address: '0x0000000000000000000000000000000000000000', symbol: 'USDC', decimals: 18 }}
    />,
  )
  expect(screen.getByText(/^up to ≈ .* USDC$/)).toBeInTheDocument()
})
