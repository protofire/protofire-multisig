import type { NewSafeFormData } from '@/components/new-safe/create'
import * as useChains from '@/hooks/useChains'
import * as relay from '@/utils/relaying'
import * as multichain from '@/features/multichain'
import * as web3 from '@/hooks/wallets/web3'
import * as createLogic from '@/components/new-safe/create/logic'
import * as createLogicUtils from '@/components/new-safe/create/logic/utils'
import * as useIsWrongChain from '@/hooks/useIsWrongChain'
import { type Chain } from '@safe-global/store/gateway/AUTO_GENERATED/chains'

import { render } from '@/tests/test-utils'
import ReviewStep, { NetworkFee } from '@/components/new-safe/create/steps/ReviewStep/index'
import * as useWallet from '@/hooks/wallets/useWallet'
import { type ConnectedWallet } from '@/hooks/wallets/useOnboard'
import { act, fireEvent, screen } from '@testing-library/react'
import { LATEST_SAFE_VERSION } from '@safe-global/utils/config/constants'
import { type SafeVersion } from '@safe-global/types-kit'
import * as creationLogic from '@/components/new-safe/create/logic'
import * as wallets from '@/utils/wallets'
import { chainBuilder } from '@/tests/builders/chains'
import { connectedWalletBuilder } from '@/tests/builders/wallet'
import * as wrongChain from '@/hooks/useIsWrongChain'
import * as gasEstimate from '@/components/new-safe/create/useEstimateSafeCreationGas'

const mockChain = {
  chainId: '100',
  chainName: 'Gnosis Chain',
  l2: false,
  features: [],
  nativeCurrency: {
    symbol: 'ETH',
  },
} as unknown as Chain

describe('NetworkFee', () => {
  it('should display the total fee', () => {
    jest.spyOn(useWallet, 'default').mockReturnValue({ label: 'MetaMask' } as unknown as ConnectedWallet)
    const mockTotalFee = '0.0123'
    const result = render(<NetworkFee totalFee={mockTotalFee} chain={mockChain} isWaived={true} />)

    expect(result.getByText(`≈ ${mockTotalFee} ${mockChain.nativeCurrency.symbol}`)).toBeInTheDocument()
  })
})

describe('ReviewStep', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('stops after three Tron address collisions without submitting a deployment', async () => {
    const chain = chainBuilder().with({ chainId: '728126428', shortName: 'trx', features: [] }).build()
    const onSubmit = jest.fn()
    jest.spyOn(useChains, 'useCurrentChain').mockReturnValue(chain)
    jest.spyOn(useChains, 'useHasFeature').mockReturnValue(false)
    jest.spyOn(wrongChain, 'default').mockReturnValue(false)
    jest.spyOn(gasEstimate, 'useEstimateSafeCreationGas').mockReturnValue({ gasLimit: 0n, gasLimitLoading: false })
    jest.spyOn(useWallet, 'default').mockReturnValue(connectedWalletBuilder().with({ chainId: chain.chainId }).build())
    jest.spyOn(web3, 'createWeb3ReadOnly').mockReturnValue({} as ReturnType<typeof web3.createWeb3ReadOnly>)
    const predict = jest
      .spyOn(multichain, 'predictAddressBasedOnReplayData')
      .mockResolvedValue('0x1234567890123456789012345678901234567890')
    const getCode = jest.spyOn(wallets, 'isSmartContract').mockResolvedValue(true)
    const deploy = jest.spyOn(creationLogic, 'createNewSafe').mockResolvedValue()
    const relayCreation = jest.spyOn(creationLogic, 'relaySafeCreation').mockResolvedValue('task-id')

    render(
      <ReviewStep
        data={{
          name: 'Test',
          networks: [chain],
          threshold: 1,
          owners: [{ name: '', address: '0x1234567890123456789012345678901234567890' }],
          saltNonce: 1000,
          safeVersion: LATEST_SAFE_VERSION as SafeVersion,
        }}
        onSubmit={onSubmit}
        onBack={jest.fn()}
        setStep={jest.fn()}
      />,
    )

    await act(async () => {
      fireEvent.click(screen.getByTestId('review-step-next-btn'))
    })

    expect(screen.getByText('Could not find an unused Safe address. Please try again.')).toBeInTheDocument()
    expect(predict).toHaveBeenCalledTimes(3)
    expect(getCode).toHaveBeenCalledTimes(3)
    expect(deploy).not.toHaveBeenCalled()
    expect(relayCreation).not.toHaveBeenCalled()
    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getByTestId('review-step-next-btn')).toBeEnabled()
  })

  it('should display a pay now pay later option for counterfactual safe setups', () => {
    const mockData: NewSafeFormData = {
      name: 'Test',
      networks: [mockChain],
      threshold: 1,
      owners: [{ name: '', address: '0x1' }],
      saltNonce: 0,
      safeVersion: LATEST_SAFE_VERSION as SafeVersion,
    }
    jest.spyOn(useChains, 'useHasFeature').mockReturnValue(true)

    const { getByText } = render(
      <ReviewStep data={mockData} onSubmit={jest.fn()} onBack={jest.fn()} setStep={jest.fn()} />,
    )

    expect(getByText('Pay now')).toBeInTheDocument()
  })

  it('should display a pay later option as selected by default for counterfactual safe setups', () => {
    const mockData: NewSafeFormData = {
      name: 'Test',
      networks: [mockChain],
      threshold: 1,
      owners: [{ name: '', address: '0x1' }],
      saltNonce: 0,
      safeVersion: LATEST_SAFE_VERSION as SafeVersion,
    }
    jest.spyOn(useChains, 'useHasFeature').mockReturnValue(true)

    render(<ReviewStep data={mockData} onSubmit={jest.fn()} onBack={jest.fn()} setStep={jest.fn()} />)

    const payLaterOption = screen.getByRole('radio', { name: /Pay later/i })
    expect(payLaterOption).toBeChecked()
  })

  it('should not display the network fee for counterfactual safes', () => {
    const mockData: NewSafeFormData = {
      name: 'Test',
      networks: [mockChain],
      threshold: 1,
      owners: [{ name: '', address: '0x1' }],
      saltNonce: 0,
      safeVersion: LATEST_SAFE_VERSION as SafeVersion,
    }
    jest.spyOn(useChains, 'useHasFeature').mockReturnValue(true)

    const { queryByText } = render(
      <ReviewStep data={mockData} onSubmit={jest.fn()} onBack={jest.fn()} setStep={jest.fn()} />,
    )

    expect(queryByText('You will have to confirm a transaction and pay an estimated fee')).not.toBeInTheDocument()
  })

  it('should not display the execution method for counterfactual safes', () => {
    const mockData: NewSafeFormData = {
      name: 'Test',
      networks: [mockChain],
      threshold: 1,
      owners: [{ name: '', address: '0x1' }],
      saltNonce: 0,
      safeVersion: LATEST_SAFE_VERSION as SafeVersion,
    }
    jest.spyOn(useChains, 'useHasFeature').mockReturnValue(true)

    const { queryByText } = render(
      <ReviewStep data={mockData} onSubmit={jest.fn()} onBack={jest.fn()} setStep={jest.fn()} />,
    )

    expect(queryByText('Who will pay gas fees:')).not.toBeInTheDocument()
  })

  it('should display the network fee for counterfactual safes if the user selects pay now', async () => {
    const mockData: NewSafeFormData = {
      name: 'Test',
      networks: [mockChain],
      threshold: 1,
      owners: [{ name: '', address: '0x1' }],
      saltNonce: 0,
      safeVersion: LATEST_SAFE_VERSION as SafeVersion,
    }
    jest.spyOn(useChains, 'useHasFeature').mockReturnValue(true)

    const { getByText } = render(
      <ReviewStep data={mockData} onSubmit={jest.fn()} onBack={jest.fn()} setStep={jest.fn()} />,
    )

    const payNow = getByText('Pay now')

    act(() => {
      fireEvent.click(payNow)
    })

    expect(getByText(/You will have to confirm a transaction and pay an estimated fee/)).toBeInTheDocument()
  })

  it('should display the execution method for counterfactual safes if the user selects pay now and there is relaying', async () => {
    const mockData: NewSafeFormData = {
      name: 'Test',
      networks: [mockChain],
      threshold: 1,
      owners: [{ name: '', address: '0x1' }],
      saltNonce: 0,
      safeVersion: LATEST_SAFE_VERSION as SafeVersion,
    }
    jest.spyOn(useChains, 'useHasFeature').mockReturnValue(true)
    jest.spyOn(relay, 'hasRemainingRelays').mockReturnValue(true)

    const { getByText } = render(
      <ReviewStep data={mockData} onSubmit={jest.fn()} onBack={jest.fn()} setStep={jest.fn()} />,
    )

    const payNow = getByText('Pay now')

    act(() => {
      fireEvent.click(payNow)
    })

    expect(getByText(/Who will pay gas fees:/)).toBeInTheDocument()
  })

  it('should display the execution method for counterfactual safes if the user selects pay now and there is relaying', async () => {
    const mockMultiChain = [
      {
        chainId: '100',
        chainName: 'Gnosis Chain',
        l2: false,
        nativeCurrency: {
          symbol: 'ETH',
        },
      },
      {
        chainId: '1',
        chainName: 'Ethereum',
        l2: false,
        nativeCurrency: {
          symbol: 'ETH',
        },
      },
    ] as Chain[]
    const mockData: NewSafeFormData = {
      name: 'Test',
      networks: mockMultiChain,
      threshold: 1,
      owners: [{ name: '', address: '0x1' }],
      saltNonce: 0,
      safeVersion: LATEST_SAFE_VERSION as SafeVersion,
    }
    jest.spyOn(useChains, 'useHasFeature').mockReturnValue(true)
    jest.spyOn(relay, 'hasRemainingRelays').mockReturnValue(true)

    const { getByText } = render(
      <ReviewStep data={mockData} onSubmit={jest.fn()} onBack={jest.fn()} setStep={jest.fn()} />,
    )

    expect(getByText(/activate your account/)).toBeInTheDocument()
    expect(getByText('Networks (2)')).toBeInTheDocument()
  })

  it('should show the gateway refusal reason when sponsored creation is rejected', async () => {
    const mockData: NewSafeFormData = {
      name: 'Test',
      networks: [mockChain],
      threshold: 1,
      owners: [{ name: '', address: '0x1' }],
      saltNonce: 0,
      safeVersion: LATEST_SAFE_VERSION as SafeVersion,
    }
    jest.spyOn(useChains, 'useCurrentChain').mockReturnValue(mockChain)
    jest.spyOn(useChains, 'useHasFeature').mockReturnValue(false)
    jest.spyOn(useIsWrongChain, 'default').mockReturnValue(false)
    jest.spyOn(useWallet, 'default').mockReturnValue({
      label: 'MetaMask',
      address: '0x1',
      provider: {},
    } as unknown as ConnectedWallet)
    jest.spyOn(relay, 'hasRemainingRelays').mockReturnValue(true)
    jest.spyOn(web3, 'createWeb3ReadOnly').mockReturnValue({} as ReturnType<typeof web3.createWeb3ReadOnly>)
    jest.spyOn(multichain, 'predictAddressBasedOnReplayData').mockResolvedValue('0xSafeAddress')
    // Independent of the salt-nonce path a given ReviewStep version takes (standard
    // getAvailableSaltNonce iteration vs. Tron's timestamp shortcut): stub it so the
    // handler reaches relaySafeCreation instead of doing real RPC-backed nonce lookup.
    jest.spyOn(createLogicUtils, 'getAvailableSaltNonce').mockResolvedValue('0')
    jest.spyOn(createLogic, 'relaySafeCreation').mockRejectedValue({
      status: 422,
      data: { code: 'BUDGET_EXHAUSTED', message: "Today's sponsored gas on this network is used up." },
    })

    const { getByTestId, findByText } = render(
      <ReviewStep data={mockData} onSubmit={jest.fn()} onBack={jest.fn()} setStep={jest.fn()} />,
    )

    await act(async () => {
      fireEvent.click(getByTestId('review-step-next-btn'))
    })

    expect(await findByText("Today's sponsored gas on this network is used up.")).toBeInTheDocument()
  })
})
