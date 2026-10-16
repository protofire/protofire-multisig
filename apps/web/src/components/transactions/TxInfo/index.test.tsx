import { render } from '@/tests/test-utils'
import * as useTronAddressHook from '@/hooks/useTronAddress'
import TxInfo from '.'
import type { CreationTransactionInfo } from '@safe-global/store/gateway/AUTO_GENERATED/transactions'

jest.mock('@/hooks/useTronAddress')

const mockUseTronAddress = useTronAddressHook.default as jest.MockedFunction<typeof useTronAddressHook.default>

describe('TxInfo', () => {
  describe('CreationTx', () => {
    const creationInfo: CreationTransactionInfo = {
      type: 'Creation',
      creator: { value: '0x0b9ca12d2ce6a6ec17df8fc602144c55a6ab1717' },
      transactionHash: '0x123',
    }

    it('renders the shortened displayAddress on a non-Tron chain', () => {
      mockUseTronAddress.mockReturnValue({
        displayAddress: creationInfo.creator.value,
        shortAddress: creationInfo.creator.value,
        copyAddress: creationInfo.creator.value,
        isTron: false,
      })

      const { getByText } = render(<TxInfo info={creationInfo} />)

      expect(getByText('Created by 0x0b9c...1717')).toBeInTheDocument()
    })

    it('renders the shortened base58 displayAddress on a Tron chain', () => {
      const base58Address = 'TB2c4z3BMsxhY6EsmkqcktUuonyVYXWFhC'

      mockUseTronAddress.mockReturnValue({
        displayAddress: base58Address,
        shortAddress: 'TB2c4...WFhC',
        copyAddress: base58Address,
        isTron: true,
      })

      const { getByText } = render(<TxInfo info={creationInfo} />)

      // Regression test for shortenAddress being called on the already-shortened
      // `shortAddress` field instead of the full `displayAddress`, which produced
      // a garbled double-shortened string on Tron.
      expect(getByText('Created by TB2c4z...WFhC')).toBeInTheDocument()
    })
  })
})
