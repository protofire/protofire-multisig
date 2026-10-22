import { render } from '@/tests/test-utils'
import AddFundsToGetStarted from './index'
import useSafeInfo from '@/hooks/useSafeInfo'
import useSafeAddress from '@/hooks/useSafeAddress'
import useChainId from '@/hooks/useChainId'
import { useChain, useCurrentChain } from '@/hooks/useChains'
import { chainBuilder } from '@/tests/builders/chains'
import { FEATURES } from '@safe-global/utils/utils/chains'

jest.mock('@/hooks/useSafeInfo')
jest.mock('@/hooks/useSafeAddress')
jest.mock('@/hooks/useChainId')
jest.mock('@/hooks/useChains')
jest.mock('@/components/common/CopyTooltip', () => ({
  __esModule: true,
  default: ({ text }: { text: string }) => <div data-testid="copy-text">{text}</div>,
}))

const SAFE_ADDRESS = '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed'
const RSK_CHAIN_ID = '30'

describe('AddFundsToGetStarted', () => {
  beforeEach(() => {
    const chain = chainBuilder()
      .with({ chainId: RSK_CHAIN_ID, shortName: 'rsk', features: [FEATURES.ROOTSTOCK_SUPPORT] })
      .build()

    ;(useSafeInfo as jest.Mock).mockReturnValue({ safe: { deployed: true } })
    ;(useSafeAddress as jest.Mock).mockReturnValue(SAFE_ADDRESS)
    ;(useChainId as jest.Mock).mockReturnValue(RSK_CHAIN_ID)
    ;(useChain as jest.Mock).mockReturnValue(chain)
    ;(useCurrentChain as jest.Mock).mockReturnValue(chain)
  })

  it('copies the lower-case address on Rootstock regardless of the checksum setting', () => {
    const { getByTestId } = render(<AddFundsToGetStarted />, {
      initialReduxState: {
        settings: { rootstockAddressChecksum: true, shortName: { copy: false, qr: false } },
      } as never,
    })

    expect(getByTestId('copy-text').textContent).toBe(SAFE_ADDRESS.toLowerCase())
  })

  it('prepends the chain prefix when copying with the prefix is enabled', () => {
    const { getByTestId } = render(<AddFundsToGetStarted />, {
      initialReduxState: {
        settings: { rootstockAddressChecksum: true, shortName: { copy: true, qr: false } },
      } as never,
    })

    expect(getByTestId('copy-text').textContent).toBe(`rsk:${SAFE_ADDRESS.toLowerCase()}`)
  })
})
