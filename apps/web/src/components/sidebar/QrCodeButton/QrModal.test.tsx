import { render } from '@/tests/test-utils'
import QrModal from './QrModal'
import useSafeAddress from '@/hooks/useSafeAddress'
import useChainId from '@/hooks/useChainId'
import { useChain, useCurrentChain } from '@/hooks/useChains'
import { chainBuilder } from '@/tests/builders/chains'
import { FEATURES } from '@safe-global/utils/utils/chains'
import { toEip1191ChecksumAddress } from '@safe-global/utils/utils/rsk-utils'

jest.mock('@/hooks/useSafeAddress')
jest.mock('@/hooks/useChainId')
jest.mock('@/hooks/useChains')
jest.mock('@/components/common/QRCode', () => ({
  __esModule: true,
  default: ({ value }: { value: string }) => <div data-testid="qr-code">{value}</div>,
}))

const SAFE_ADDRESS = '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed'
const RSK_CHAIN_ID = '30'

describe('QrModal', () => {
  beforeEach(() => {
    const chain = chainBuilder()
      .with({ chainId: RSK_CHAIN_ID, shortName: 'rsk', features: [FEATURES.ROOTSTOCK_SUPPORT] })
      .build()

    ;(useSafeAddress as jest.Mock).mockReturnValue(SAFE_ADDRESS)
    ;(useChainId as jest.Mock).mockReturnValue(RSK_CHAIN_ID)
    ;(useChain as jest.Mock).mockReturnValue(chain)
    ;(useCurrentChain as jest.Mock).mockReturnValue(chain)
  })

  it('encodes the lower-case address on Rootstock while displaying the EIP-1191 one', () => {
    const { getByTestId, getByText } = render(<QrModal onClose={jest.fn()} />)

    expect(getByTestId('qr-code').textContent).toBe(SAFE_ADDRESS.toLowerCase())
    expect(getByText(toEip1191ChecksumAddress(SAFE_ADDRESS, RSK_CHAIN_ID))).toBeInTheDocument()
  })

  it('encodes the lower-case address when the checksum setting is off', () => {
    const { getByTestId } = render(<QrModal onClose={jest.fn()} />, {
      initialReduxState: {
        settings: { rootstockAddressChecksum: false, shortName: { copy: false, qr: false } },
      } as never,
    })

    expect(getByTestId('qr-code').textContent).toBe(SAFE_ADDRESS.toLowerCase())
  })

  it('keeps the chain prefix in front of the lower-case address', () => {
    const { getByTestId } = render(<QrModal onClose={jest.fn()} />, {
      initialReduxState: {
        settings: { rootstockAddressChecksum: true, shortName: { copy: false, qr: true } },
      } as never,
    })

    expect(getByTestId('qr-code').textContent).toBe(`rsk:${SAFE_ADDRESS.toLowerCase()}`)
  })
})
