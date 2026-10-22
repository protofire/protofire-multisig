import { type ReactElement } from 'react'
import { fireEvent, waitFor } from '@testing-library/react'
import { OperationType } from '@safe-global/types-kit'
import type { AsyncResult } from '@safe-global/utils/hooks/useAsync'
import type {
  ContractAnalysisResults,
  RecipientAnalysisResults,
  ThreatAnalysisResults,
} from '@safe-global/utils/features/safe-shield/types'
import * as useWallet from '@/hooks/wallets/useWallet'
import { PROPOSE_OFF_CHAIN_SIGNATURES_UNSUPPORTED } from '@/hooks/wallets/useSupportsOffChainSignatures'
import { render } from '@/tests/test-utils'
import { createMockSafeTransaction } from '@/tests/transactions'
import { connectedWalletBuilder } from '@/tests/builders/wallet'
import { ProposerForm } from './ProposerForm'

jest.mock('@/components/common/CheckWallet', () => ({
  __esModule: true,
  default({ children }: { children: (ok: boolean) => ReactElement }) {
    return children(true)
  },
}))

describe('ProposerForm', () => {
  const safeTx = createMockSafeTransaction({ to: '0x1', data: '0x', operation: OperationType.Call })

  const buildProps = (signProposerTx = jest.fn().mockResolvedValue('txId'), isHedera = true) => ({
    safeTx,
    supportsOffChainSignatures: true,
    isHedera,
    txActions: {
      proposeTx: jest.fn(),
      signTx: jest.fn(),
      addToBatch: jest.fn(),
      executeTx: jest.fn(),
      signProposerTx,
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
  })

  beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(useWallet, 'default').mockReturnValue(connectedWalletBuilder().build())
  })

  it('shows an error when proposing fails', async () => {
    const props = buildProps(jest.fn().mockRejectedValue(new Error('Something broke')))
    const { getByText, getByTestId } = render(<ProposerForm {...props} />)

    fireEvent.click(getByTestId('sign-btn'))

    await waitFor(() => {
      expect(getByText('Error submitting the transaction. Please try again.')).toBeInTheDocument()
    })
    expect(getByTestId('sign-btn')).toBeEnabled()
  })

  it('keeps the production behaviour (no inline error) off Hedera when proposing fails', async () => {
    const props = buildProps(jest.fn().mockRejectedValue(new Error('Something broke')), false)
    const { queryByText, getByTestId } = render(<ProposerForm {...props} />)

    fireEvent.click(getByTestId('sign-btn'))

    await waitFor(() => {
      expect(getByTestId('sign-btn')).toBeEnabled()
    })
    expect(queryByText('Error submitting the transaction. Please try again.')).not.toBeInTheDocument()
  })

  it('shows a rejection message instead of an error when the user rejects', async () => {
    const rejection = Object.assign(new Error('User rejected the request.'), { code: 4001 })
    const props = buildProps(jest.fn().mockRejectedValue(rejection))
    const { queryByText, getByTestId } = render(<ProposerForm {...props} />)

    fireEvent.click(getByTestId('sign-btn'))

    await waitFor(() => {
      expect(props.txActions.signProposerTx).toHaveBeenCalled()
    })
    expect(queryByText('Error submitting the transaction. Please try again.')).not.toBeInTheDocument()
  })

  it('warns and disables proposing when the wallet cannot create off-chain signatures', () => {
    const props = buildProps()
    const { getByText, getByTestId } = render(<ProposerForm {...props} supportsOffChainSignatures={false} />)

    expect(getByText(PROPOSE_OFF_CHAIN_SIGNATURES_UNSUPPORTED)).toBeInTheDocument()
    expect(getByTestId('sign-btn')).toBeDisabled()
  })
})
