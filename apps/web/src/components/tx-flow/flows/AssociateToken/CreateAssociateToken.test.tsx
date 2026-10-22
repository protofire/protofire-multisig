import { fireEvent, waitFor } from '@testing-library/react'
import { render } from '@/tests/test-utils'
import * as useChains from '@/hooks/useChains'
import * as hedera from '@/utils/hedera'
import { chainBuilder } from '@/tests/builders/chains'
import { FEATURES } from '@safe-global/utils/utils/chains'
import { initialContext, TxFlowContext } from '@/components/tx-flow/TxFlowProvider'
import CreateAssociateToken from './CreateAssociateToken'

jest.mock('@/hooks/useSafeInfo', () => ({
  __esModule: true,
  default: () => ({ safeAddress: '0x3DDDCE646712500aB55E1b2d6E61de4C409f50EF' }),
}))

const token = {
  tokenId: '0.0.731861',
  evmAddress: '0x00000000000000000000000000000000000b2ad5',
  name: 'SAUCE',
  symbol: 'SAUCE',
  decimals: 6,
  type: 'FUNGIBLE_COMMON' as const,
  deleted: false,
}

describe('CreateAssociateToken', () => {
  const onNext = jest.fn()

  beforeEach(() => {
    jest.restoreAllMocks()
    jest.spyOn(useChains, 'useCurrentChain').mockReturnValue(
      chainBuilder()
        .with({ chainId: '295', isTestnet: false, features: [FEATURES.HEDERA] })
        .build(),
    )
  })

  const renderForm = () =>
    render(
      <TxFlowContext.Provider value={{ ...initialContext, onNext }}>
        <CreateAssociateToken />
      </TxFlowContext.Provider>,
    )

  it('should show the already-associated error live, without clicking Next', async () => {
    jest.spyOn(hedera, 'getHederaTokenMetadata').mockResolvedValue(token)
    const associatedSpy = jest.spyOn(hedera, 'isHederaTokenAssociated').mockResolvedValue(true)

    const { getByRole, findAllByText } = renderForm()

    fireEvent.change(getByRole('textbox'), { target: { value: token.tokenId } })

    await findAllByText('The token address is already associated with this Safe account')
    // Checks only the entered token, by its native id, rather than listing every association
    expect(associatedSpy).toHaveBeenCalledWith(expect.anything(), expect.any(String), token.tokenId)
    expect(getByRole('button', { name: 'Next' })).toBeDisabled()
    expect(onNext).not.toHaveBeenCalled()
  })

  it('should enable Next once a not-yet-associated token resolves, and proceed on click', async () => {
    jest.spyOn(hedera, 'getHederaTokenMetadata').mockResolvedValue(token)
    jest.spyOn(hedera, 'isHederaTokenAssociated').mockResolvedValue(false)

    const { getByRole } = renderForm()

    fireEvent.change(getByRole('textbox'), { target: { value: token.tokenId } })

    await waitFor(() => {
      expect(getByRole('button', { name: 'Next' })).toBeEnabled()
    })

    fireEvent.click(getByRole('button', { name: 'Next' }))

    expect(onNext).toHaveBeenCalledWith({ token })
  })
})
