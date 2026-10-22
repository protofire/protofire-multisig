import { render } from '@/tests/test-utils'
import { HederaNetwork } from '@/utils/hedera'
import { WalletInfo } from '@/components/common/WalletInfo/index'
import { type EIP1193Provider, type OnboardAPI } from '@web3-onboard/core'
import { act } from '@testing-library/react'
import * as useHederaAccountIdHook from '@/hooks/useHederaAccountId'
import * as useChains from '@/hooks/useChains'
import { chainBuilder } from '@/tests/builders/chains'
import css from '@/components/common/WalletInfo/styles.module.css'

const mockWallet = {
  address: '0x1234567890123456789012345678901234567890',
  chainId: '5',
  label: '',
  provider: null as unknown as EIP1193Provider,
}

const mockOnboard = {
  connectWallet: jest.fn(),
  disconnectWallet: jest.fn(),
  setChain: jest.fn(),
} as unknown as OnboardAPI

describe('WalletInfo', () => {
  beforeEach(() => {
    jest.resetAllMocks()
  })

  it('should display the wallet address', () => {
    const { getByText } = render(
      <WalletInfo
        wallet={mockWallet}
        onboard={mockOnboard}
        addressBook={{}}
        handleClose={jest.fn()}
        balance={undefined}
        currentChainId="1"
      />,
    )

    expect(getByText('0x1234...7890')).toBeInTheDocument()
  })

  it('should display a switch wallet button', () => {
    const { getByText } = render(
      <WalletInfo
        wallet={mockWallet}
        onboard={mockOnboard}
        addressBook={{}}
        handleClose={jest.fn()}
        balance={undefined}
        currentChainId="1"
      />,
    )

    expect(getByText('Switch wallet')).toBeInTheDocument()
  })

  it('should disconnect the wallet when the button is clicked', () => {
    const { getByText } = render(
      <WalletInfo
        wallet={mockWallet}
        onboard={mockOnboard}
        addressBook={{}}
        handleClose={jest.fn()}
        balance={undefined}
        currentChainId="1"
      />,
    )

    const disconnectButton = getByText('Disconnect')

    expect(disconnectButton).toBeInTheDocument()

    act(() => {
      disconnectButton.click()
    })

    expect(mockOnboard.disconnectWallet).toHaveBeenCalled()
  })

  it('should show the native Hedera account id above the address, sharing one avatar and no separate wallet-name line', () => {
    jest
      .spyOn(useHederaAccountIdHook, 'default')
      .mockReturnValue({ accountId: '0.0.10822511', network: HederaNetwork.TESTNET, isHedera: true })
    jest.spyOn(useChains, 'useChain').mockReturnValue(chainBuilder().with({ chainId: '296' }).build())

    const hederaWallet = {
      ...mockWallet,
      label: 'HashPack',
      chainId: '296',
      address: '0xd89cfd973d251ff04d345a4962afb5efa6382036',
    }

    const { getByText, getAllByTestId } = render(
      <WalletInfo
        wallet={hederaWallet}
        onboard={mockOnboard}
        addressBook={{}}
        handleClose={jest.fn()}
        balance={undefined}
        currentChainId="296"
      />,
    )

    const accountIdEl = getByText('0.0.10822511')
    const addressEl = getByText('0xd89c...2036')

    expect(accountIdEl).toBeInTheDocument()
    expect(addressEl).toBeInTheDocument()
    // The account id must not share the address's fixed-height container — that's exactly what
    // previously caused the two to visually overlap (see the CSS `.address` height).
    expect(addressEl.closest(`.${css.address}`)).toBeNull()
    // Exactly one explorer link in the identity block — HashScan resolves the account-id and
    // address views to the same page, so a second link there would just be a redundant dupe.
    expect(getAllByTestId('explorer-btn')).toHaveLength(1)
    // "HashPack" must appear exactly once (the "Wallet" row) — not duplicated as a separate
    // name line next to the address, which is what cluttered the identity block before.
    // getByText throws if it matches more than one element, so this alone proves there's no dupe.
    expect(getByText('HashPack')).toBeInTheDocument()
  })
})
