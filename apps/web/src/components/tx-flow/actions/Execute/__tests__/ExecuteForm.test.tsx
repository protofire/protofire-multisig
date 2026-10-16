import { EthSafeSignature } from '@safe-global/protocol-kit'
import type { Relay } from '@safe-global/store/gateway/AUTO_GENERATED/relay'
import { type AsyncResult } from '@safe-global/utils/hooks/useAsync'
import { createMockSafeTransaction } from '@/tests/transactions'
import { OperationType } from '@safe-global/types-kit'
import { type ReactElement } from 'react'
import { ExecuteForm } from '../ExecuteForm'
import * as useGasLimit from '@/hooks/useGasLimit'
import * as useIsValidExecution from '@/hooks/useIsValidExecution'
import * as useWalletCanRelay from '@/hooks/useWalletCanRelay'
import * as relayUtils from '@/utils/relaying'
import * as walletCanPay from '@/hooks/useWalletCanPay'
import * as useValidateTxData from '@/hooks/useValidateTxData'
import * as useChainsHook from '@/hooks/useChains'
import { FEATURES } from '@/utils/featureToggled'
import { defaultSafeInfo } from '@safe-global/store/slices/SafeInfo/utils'
import useSafeInfo from '@/hooks/useSafeInfo'
import * as gasTokenSupport from '@/hooks/useGasTokenSupport'
import * as gasTokenFee from '@/services/tx/gasTokenFee'
import { render } from '@/tests/test-utils'
import { fireEvent, waitFor } from '@testing-library/react'
import type {
  RecipientAnalysisResults,
  ContractAnalysisResults,
  ThreatAnalysisResults,
} from '@safe-global/utils/features/safe-shield/types'

// We assume that CheckWallet always returns true
jest.mock('@/components/common/CheckWallet', () => ({
  __esModule: true,
  default({ children }: { children: (ok: boolean) => ReactElement }) {
    return children(true)
  },
}))

jest.mock('@/hooks/useSafeInfo')

describe('ExecuteForm', () => {
  const safeTransaction = createMockSafeTransaction({
    to: '0x1',
    data: '0x',
    operation: OperationType.Call,
  })

  const defaultProps = {
    onSubmit: jest.fn(),
    isOwner: true,
    txId: '0x123123',
    isExecutionLoop: false,
    relays: [undefined, undefined, false] as AsyncResult<Relay>,
    txActions: {
      proposeTx: jest.fn(),
      signTx: jest.fn(),
      addToBatch: jest.fn(),
      executeTx: jest.fn(),
      signProposerTx: jest.fn(),
    },
    txSecurity: {
      setRecipientAddresses: jest.fn(),
      setSafeTx: jest.fn(),
      recipient: [undefined, undefined, false] as AsyncResult<RecipientAnalysisResults>,
      contract: [undefined, undefined, false] as AsyncResult<ContractAnalysisResults>,
      threat: [undefined, undefined, false] as AsyncResult<ThreatAnalysisResults>,
      nestedThreat: [undefined, undefined, false] as AsyncResult<ThreatAnalysisResults>,
      isNested: false,
      needsRiskConfirmation: false,
      isRiskConfirmed: false,
      setIsRiskConfirmed: jest.fn(),
      safeAnalysis: null,
      addToTrustedList: jest.fn(),
    },
    options: [
      { id: 'execute', label: 'Execute' },
      { id: 'sign', label: 'Sign' },
    ],
    onChange: jest.fn(),
    slotId: 'execute',
  }

  beforeEach(() => {
    jest.clearAllMocks()
    jest.mocked(useSafeInfo).mockReturnValue({
      safe: { ...defaultSafeInfo, threshold: 1 },
      safeAddress: '',
      safeLoaded: true,
      safeLoading: false,
    })

    jest.spyOn(useValidateTxData, 'useValidateTxData').mockReturnValue([undefined, undefined, false])
    jest.spyOn(gasTokenSupport, 'useGasTokenSupport').mockReturnValue({
      retry: jest.fn(),
      gasTokens: undefined,
      isSupported: false,
      isLoading: false,
      error: undefined,
      gasToken: undefined,
      refundReceiver: undefined,
    })
    jest.spyOn(gasTokenFee, 'isGasTokenRelayTx').mockReturnValue(false)
  })

  it('keeps wallet execution for a foreign token refund transaction', () => {
    const mockExecuteTx = jest.fn()
    jest.spyOn(useWalletCanRelay, 'default').mockReturnValue([false, undefined, false])
    const foreignRefundTx = createMockSafeTransaction(safeTransaction.data)
    Object.assign(foreignRefundTx.data, {
      gasPrice: '1',
      gasToken: '0x1111111111111111111111111111111111111111',
      refundReceiver: '0x2222222222222222222222222222222222222222',
    })

    const { getByText } = render(
      <ExecuteForm
        {...defaultProps}
        safeTx={foreignRefundTx}
        txActions={{ ...defaultProps.txActions, executeTx: mockExecuteTx }}
      />,
    )

    const button = getByText('Execute')
    expect(button).not.toBeDisabled()
    fireEvent.click(button)
    expect(mockExecuteTx).toHaveBeenCalledWith(expect.anything(), foreignRefundTx, '0x123123', undefined, false)
  })

  it('waits for configuration before allowing wallet execution for a foreign refund', () => {
    const mockExecuteTx = jest.fn()
    const foreignRefundTx = createMockSafeTransaction(safeTransaction.data)
    Object.assign(foreignRefundTx.data, {
      gasPrice: '1',
      gasToken: '0x1111111111111111111111111111111111111111',
      refundReceiver: '0x2222222222222222222222222222222222222222',
    })
    jest.spyOn(gasTokenSupport, 'useGasTokenSupport').mockReturnValue({
      retry: jest.fn(),
      gasTokens: undefined,
      isSupported: false,
      isLoading: true,
      error: undefined,
      gasToken: undefined,
      refundReceiver: undefined,
    })

    const { getByText, rerender } = render(
      <ExecuteForm
        {...defaultProps}
        safeTx={foreignRefundTx}
        txActions={{ ...defaultProps.txActions, executeTx: mockExecuteTx }}
      />,
    )

    fireEvent.submit(getByText('Execute').closest('form') as HTMLFormElement)
    expect(mockExecuteTx).not.toHaveBeenCalled()
    jest.spyOn(gasTokenSupport, 'useGasTokenSupport').mockReturnValue({
      retry: jest.fn(),
      gasTokens: undefined,
      isSupported: true,
      isLoading: false,
      error: undefined,
      gasToken: { address: '0x3333333333333333333333333333333333333333', symbol: 'USDC', decimals: 6 },
      refundReceiver: '0x4444444444444444444444444444444444444444',
    })
    rerender(
      <ExecuteForm
        {...defaultProps}
        safeTx={foreignRefundTx}
        txActions={{ ...defaultProps.txActions, executeTx: mockExecuteTx }}
      />,
    )
    fireEvent.submit(getByText('Execute').closest('form') as HTMLFormElement)
    expect(mockExecuteTx).toHaveBeenCalledWith(expect.anything(), foreignRefundTx, '0x123123', undefined, false)
  })

  it('blocks wallet fallback for a removed token refunding the configured treasury', () => {
    const transaction = createMockSafeTransaction(safeTransaction.data)
    Object.assign(transaction.data, {
      gasPrice: '1',
      gasToken: '0x1111111111111111111111111111111111111111',
      refundReceiver: '0x2222222222222222222222222222222222222222',
    })
    jest.spyOn(gasTokenSupport, 'useGasTokenSupport').mockReturnValue({
      retry: jest.fn(),
      gasTokens: undefined,
      isSupported: true,
      isLoading: false,
      error: undefined,
      gasToken: { address: '0x3333333333333333333333333333333333333333', symbol: 'USDC', decimals: 6 },
      refundReceiver: transaction.data.refundReceiver,
    })
    const mockExecuteTx = jest.fn()
    const { getByText } = render(
      <ExecuteForm
        {...defaultProps}
        safeTx={transaction}
        txActions={{ ...defaultProps.txActions, executeTx: mockExecuteTx }}
      />,
    )

    expect(getByText('Execute')).toBeDisabled()
    fireEvent.submit(getByText('Execute').closest('form') as HTMLFormElement)
    expect(mockExecuteTx).not.toHaveBeenCalled()
  })

  it('blocks a supported Safe-pays transaction when no compatible relayer is available', () => {
    const matchedRefundTx = createMockSafeTransaction(safeTransaction.data)
    Object.assign(matchedRefundTx.data, {
      gasPrice: '1',
      gasToken: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
      refundReceiver: '0x798D0d04E1c52020d298b6246D9A87ceb4C08b36',
    })
    jest.spyOn(gasTokenSupport, 'useGasTokenSupport').mockReturnValue({
      retry: jest.fn(),
      gasTokens: undefined,
      isSupported: true,
      isLoading: false,
      error: undefined,
      gasToken: { address: matchedRefundTx.data.gasToken, symbol: 'USDC', decimals: 6 },
      refundReceiver: matchedRefundTx.data.refundReceiver,
    })
    jest.spyOn(gasTokenFee, 'isGasTokenRelayTx').mockReturnValue(true)

    const { getByText } = render(<ExecuteForm {...defaultProps} safeTx={matchedRefundTx} />)

    expect(getByText(/cannot relay this transaction/i)).toBeInTheDocument()
    expect(getByText('Sign and send')).toBeDisabled()
  })

  it.each([false, true])(
    'uses the compatible relayer for a supported Safe-pays transaction, fully signed=%s',
    async (fullySigned) => {
      const mockExecuteTx = jest.fn()
      const matchedRefundTx = createMockSafeTransaction(safeTransaction.data)
      if (fullySigned)
        matchedRefundTx.addSignature(new EthSafeSignature('0x1111111111111111111111111111111111111111', '0x'))
      Object.assign(matchedRefundTx.data, {
        gasPrice: '1',
        gasToken: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
        refundReceiver: '0x798D0d04E1c52020d298b6246D9A87ceb4C08b36',
      })
      jest.spyOn(gasTokenSupport, 'useGasTokenSupport').mockReturnValue({
        retry: jest.fn(),
        gasTokens: undefined,
        isSupported: true,
        isLoading: false,
        error: undefined,
        gasToken: { address: matchedRefundTx.data.gasToken, symbol: 'USDC', decimals: 6 },
        refundReceiver: matchedRefundTx.data.refundReceiver,
      })
      jest.spyOn(gasTokenFee, 'isGasTokenRelayTx').mockReturnValue(true)
      jest.spyOn(useWalletCanRelay, 'default').mockReturnValue([true, undefined, false])

      const { getByText, queryByText } = render(
        <ExecuteForm
          {...defaultProps}
          safeTx={matchedRefundTx}
          txActions={{ ...defaultProps.txActions, executeTx: mockExecuteTx }}
        />,
      )

      expect(getByText('No network fee from your connected wallet.')).toBeInTheDocument()
      expect(queryByText('Free')).not.toBeInTheDocument()
      fireEvent.click(getByText(fullySigned ? 'Send transaction' : 'Sign and send'))

      await waitFor(() => {
        expect(mockExecuteTx).toHaveBeenCalledWith(expect.anything(), matchedRefundTx, '0x123123', undefined, true)
      })
    },
  )

  it.each([true, false])('handles unavailable support with the chain feature enabled=%s', (enabled) => {
    const transaction = createMockSafeTransaction(safeTransaction.data)
    Object.assign(transaction.data, {
      gasPrice: '1',
      gasToken: '0x1111111111111111111111111111111111111111',
      refundReceiver: '0x798D0d04E1c52020d298b6246D9A87ceb4C08b36',
    })
    jest.spyOn(useWalletCanRelay, 'default').mockReturnValue([false, undefined, false])
    const chainSpy = jest.spyOn(useChainsHook, 'useCurrentChain').mockReturnValue({
      chainId: '84532',
      features: enabled ? [FEATURES.PAY_FROM_SAFE] : [],
    } as never)
    const { getByText } = render(<ExecuteForm {...defaultProps} safeTx={transaction} />)
    if (enabled) expect(getByText('Execute')).toBeDisabled()
    else expect(getByText('Execute')).toBeEnabled()
    chainSpy.mockRestore()
  })

  it('blocks a known token refund transaction while support is loading', () => {
    const matchedRefundTx = createMockSafeTransaction(safeTransaction.data)
    Object.assign(matchedRefundTx.data, {
      gasPrice: '1',
      gasToken: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
      refundReceiver: '0x798D0d04E1c52020d298b6246D9A87ceb4C08b36',
    })
    jest.spyOn(gasTokenSupport, 'useGasTokenSupport').mockReturnValue({
      retry: jest.fn(),
      gasTokens: undefined,
      isSupported: false,
      isLoading: true,
      error: undefined,
      gasToken: { address: matchedRefundTx.data.gasToken, symbol: 'USDC', decimals: 6 },
      refundReceiver: matchedRefundTx.data.refundReceiver,
    })
    jest.spyOn(gasTokenFee, 'isGasTokenRelayTx').mockReturnValue(true)
    const chainSpy = jest
      .spyOn(useChainsHook, 'useCurrentChain')
      .mockReturnValue({ chainId: '84532', features: [] } as never)

    const { getByText } = render(<ExecuteForm {...defaultProps} safeTx={matchedRefundTx} />)

    expect(getByText('Execute')).toBeDisabled()
    chainSpy.mockRestore()
  })

  it('does not submit when token-fee support is still loading', () => {
    const mockExecuteTx = jest.fn()
    const matchedRefundTx = createMockSafeTransaction(safeTransaction.data)
    Object.assign(matchedRefundTx.data, {
      gasPrice: '1',
      gasToken: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
      refundReceiver: '0x798D0d04E1c52020d298b6246D9A87ceb4C08b36',
    })
    jest.spyOn(gasTokenSupport, 'useGasTokenSupport').mockReturnValue({
      retry: jest.fn(),
      gasTokens: undefined,
      isSupported: false,
      isLoading: true,
      error: undefined,
      gasToken: { address: matchedRefundTx.data.gasToken, symbol: 'USDC', decimals: 6 },
      refundReceiver: matchedRefundTx.data.refundReceiver,
    })
    jest.spyOn(gasTokenFee, 'isGasTokenRelayTx').mockReturnValue(true)
    const chainSpy = jest
      .spyOn(useChainsHook, 'useCurrentChain')
      .mockReturnValue({ chainId: '84532', features: [] } as never)

    const { getByText } = render(
      <ExecuteForm
        {...defaultProps}
        safeTx={matchedRefundTx}
        txActions={{ ...defaultProps.txActions, executeTx: mockExecuteTx }}
      />,
    )

    fireEvent.submit(getByText('Execute').closest('form') as HTMLFormElement)
    expect(mockExecuteTx).not.toHaveBeenCalled()
    chainSpy.mockRestore()
  })

  it('does not fall back to wallet execution when token-fee support fails', () => {
    const matchedRefundTx = createMockSafeTransaction(safeTransaction.data)
    Object.assign(matchedRefundTx.data, {
      gasPrice: '1',
      gasToken: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
      refundReceiver: '0x798D0d04E1c52020d298b6246D9A87ceb4C08b36',
    })
    jest.spyOn(gasTokenSupport, 'useGasTokenSupport').mockReturnValue({
      retry: jest.fn(),
      gasTokens: undefined,
      isSupported: false,
      isLoading: false,
      error: new Error('support unavailable'),
      gasToken: { address: matchedRefundTx.data.gasToken, symbol: 'USDC', decimals: 6 },
      refundReceiver: matchedRefundTx.data.refundReceiver,
    })
    jest.spyOn(gasTokenFee, 'isGasTokenRelayTx').mockReturnValue(true)
    const chainSpy = jest
      .spyOn(useChainsHook, 'useCurrentChain')
      .mockReturnValue({ chainId: '84532', features: [] } as never)

    const { getByText } = render(<ExecuteForm {...defaultProps} safeTx={matchedRefundTx} />)

    expect(getByText('Execute')).toBeDisabled()
    chainSpy.mockRestore()
  })

  it('shows estimated fees', () => {
    const { getByText } = render(<ExecuteForm {...defaultProps} />)

    expect(getByText('Estimated fee')).toBeInTheDocument()
  })

  it('shows a non-owner error if the transaction still needs signatures and its not an owner', () => {
    const { getByText } = render(<ExecuteForm {...defaultProps} isOwner={false} onlyExecute={false} />)

    expect(
      getByText("You are currently not a signer of this Safe Account and won't be able to submit this transaction."),
    ).toBeInTheDocument()
  })

  it('does not show a non-owner error if the transaction is fully signed and its not an owner', () => {
    const { queryByText } = render(<ExecuteForm {...defaultProps} isOwner={false} onlyExecute={true} />)

    expect(
      queryByText("You are currently not a signer of this Safe Account and won't be able to submit this transaction."),
    ).not.toBeInTheDocument()
  })

  it('shows an error if the same safe tries to execute', () => {
    const { getByText } = render(<ExecuteForm {...defaultProps} isExecutionLoop={true} />)

    expect(
      getByText('Cannot execute a transaction from the Safe Account itself, please connect a different account.'),
    ).toBeInTheDocument()
  })

  it('shows an error if the connected wallet has insufficient funds to execute and relaying is not selected', () => {
    jest.spyOn(walletCanPay, 'default').mockReturnValue(false)
    jest.spyOn(useWalletCanRelay, 'default').mockReturnValue([true, undefined, false])
    jest.spyOn(relayUtils, 'hasRemainingRelays').mockReturnValue(true)

    const { getByText, queryByText, getByTestId } = render(<ExecuteForm {...defaultProps} />)

    expect(
      queryByText("Your connected wallet doesn't have enough funds to execute this transaction."),
    ).not.toBeInTheDocument()

    const executeWithWalletOption = getByTestId('connected-wallet-execution-method')
    fireEvent.click(executeWithWalletOption)

    expect(
      getByText("Your connected wallet doesn't have enough funds to execute this transaction."),
    ).toBeInTheDocument()
  })

  it('shows a relaying option if relaying is enabled', () => {
    jest.spyOn(useWalletCanRelay, 'default').mockReturnValue([true, undefined, false])
    jest.spyOn(relayUtils, 'hasRemainingRelays').mockReturnValue(true)

    const { getByText } = render(<ExecuteForm {...defaultProps} />)

    expect(getByText('Who will pay gas fees:')).toBeInTheDocument()
  })

  it('shows an execution validation error', () => {
    jest
      .spyOn(useIsValidExecution, 'default')
      .mockReturnValue({ executionValidationError: new Error('Some error'), isValidExecutionLoading: false })

    const { getByText } = render(
      <ExecuteForm
        {...defaultProps}
        txActions={{
          proposeTx: jest.fn(),
          signTx: jest.fn(),
          addToBatch: jest.fn(),
          executeTx: jest.fn(),
          signProposerTx: jest.fn(),
        }}
      />,
    )

    expect(
      getByText('This transaction will most likely fail. To save gas costs, reject this transaction.'),
    ).toBeInTheDocument()
  })

  it('shows a gasLimit error', () => {
    jest
      .spyOn(useGasLimit, 'default')
      .mockReturnValue({ gasLimitError: new Error('Gas limit error'), gasLimitLoading: false })

    const { getByText } = render(<ExecuteForm {...defaultProps} />)

    expect(
      getByText('This transaction will most likely fail. To save gas costs, reject this transaction.'),
    ).toBeInTheDocument()
  })

  it('shows a short message instead of a failure error when the signed estimation was rejected', () => {
    jest.spyOn(useChainsHook, 'useHasFeature').mockReturnValue(true)
    jest.spyOn(useGasLimit, 'default').mockReturnValue({
      gasLimitError: Object.assign(new Error('user rejected action'), { code: 'ACTION_REJECTED' }),
      gasLimitLoading: false,
    })

    const { getByText, queryByText } = render(<ExecuteForm {...defaultProps} />)

    expect(getByText(/You rejected the signature request/)).toBeInTheDocument()
    expect(queryByText(/This transaction will most likely fail/)).not.toBeInTheDocument()
  })

  it('execute the tx when the submit button is clicked', async () => {
    const mockExecuteTx = jest.fn()

    const { getByText } = render(
      <ExecuteForm
        {...defaultProps}
        safeTx={safeTransaction}
        txActions={{
          proposeTx: jest.fn(),
          signTx: jest.fn(),
          addToBatch: jest.fn(),
          executeTx: mockExecuteTx,
          signProposerTx: jest.fn(),
        }}
      />,
    )

    const button = getByText('Execute')

    fireEvent.click(button)

    await waitFor(() => {
      expect(mockExecuteTx).toHaveBeenCalled()
    })
  })

  it('shows a disabled submit button if there is no safeTx', () => {
    const { getByText } = render(<ExecuteForm {...defaultProps} safeTx={undefined} />)

    const button = getByText('Execute')

    expect(button).toBeInTheDocument()
    expect(button).toBeDisabled()
  })

  it('shows a disabled submit button if passed via props', () => {
    const { getByText } = render(<ExecuteForm safeTx={safeTransaction} disableSubmit {...defaultProps} />)

    const button = getByText('Execute')

    expect(button).toBeInTheDocument()
    expect(button).toBeDisabled()
  })

  it('shows a disabled submit button if the same safe is connected', () => {
    const { getByText } = render(<ExecuteForm {...defaultProps} isExecutionLoop={true} />)

    const button = getByText('Execute')

    expect(button).toBeInTheDocument()
    expect(button).toBeDisabled()
  })

  it('shows a disabled submit button if there is a high or critical risk and user has not confirmed it', () => {
    const { getByText } = render(
      <ExecuteForm
        {...defaultProps}
        safeTx={safeTransaction}
        txSecurity={{ ...defaultProps.txSecurity, isRiskConfirmed: false, needsRiskConfirmation: true }}
      />,
    )

    const button = getByText('Execute')

    expect(button).toBeInTheDocument()
    expect(button).toBeDisabled()
  })

  it('shows an enabled submit button if there is a high or critical risk and user has confirmed it', () => {
    const { getByText } = render(
      <ExecuteForm
        {...defaultProps}
        safeTx={safeTransaction}
        txSecurity={{ ...defaultProps.txSecurity, isRiskConfirmed: true, needsRiskConfirmation: true }}
      />,
    )

    const button = getByText('Execute')

    expect(button).toBeInTheDocument()
    expect(button).not.toBeDisabled()
  })
})
