import { getFeeTokenSpend } from '../useGasTokenFeeOptions'

const NATIVE = { address: '0x0000000000000000000000000000000000000000', symbol: 'USDC', decimals: 18 }
const SAFE = '0x1111111111111111111111111111111111111111'

describe('getFeeTokenSpend', () => {
  it('reserves the transaction value when the fee token is native', () => {
    const tx = { to: '0x2222222222222222222222222222222222222222', value: '500', data: '0x', operation: 0, nonce: 1 }
    expect(getFeeTokenSpend(tx, NATIVE, SAFE)).toBe(500n)
  })

  it('reserves nothing for an ERC-20 fee token on a native-value transfer', () => {
    const erc20 = { ...NATIVE, address: '0x3333333333333333333333333333333333333333' }
    const tx = { to: '0x2222222222222222222222222222222222222222', value: '500', data: '0x', operation: 0, nonce: 1 }
    expect(getFeeTokenSpend(tx, erc20, SAFE)).toBe(0n)
  })
})
