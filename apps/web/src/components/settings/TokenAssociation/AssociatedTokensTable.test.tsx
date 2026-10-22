import type { ReactElement } from 'react'
import { fireEvent, render, waitFor } from '@/tests/test-utils'
import * as hedera from '@/utils/hedera'
import * as EthHashInfo from '@/components/common/EthHashInfo'
import { TxModalContext } from '@/components/tx-flow'
import AssociatedTokensTable from './AssociatedTokensTable'

jest.mock('@/hooks/useSafeInfo')

jest.mock('@/components/common/CheckWallet', () => ({
  __esModule: true,
  default: ({ children }: { children: (ok: boolean) => ReactElement }) => children(true),
}))

jest.mock('@/components/tx-flow/flows', () => ({
  __esModule: true,
  DissociateTokenFlow: ({ token }: { token: { tokenId: string } }) => <div>Dissociate {token.tokenId}</div>,
}))

const mockUseSafeInfo = jest.requireMock('@/hooks/useSafeInfo').default as jest.Mock

const renderTable = (network: hedera.HederaNetwork | undefined, setTxFlow = jest.fn()) =>
  render(
    <TxModalContext.Provider value={{ txFlow: undefined, setTxFlow, setFullWidth: jest.fn() }}>
      <AssociatedTokensTable network={network} />
    </TxModalContext.Provider>,
  )

const buildToken = (tokenId: string): hedera.HederaAssociatedToken => ({
  tokenId,
  evmAddress: hedera.hederaEntityIdToEvmAddress(tokenId),
  name: 'SaucerSwap',
  symbol: 'SAUCE',
  balance: 0,
  decimals: 6,
  freezeStatus: 'NOT_APPLICABLE',
  createdAt: new Date(),
})

describe('AssociatedTokensTable', () => {
  let ethHashInfoSpy: jest.SpyInstance

  beforeEach(() => {
    jest.restoreAllMocks()
    // The full EthHashInfo is slow to render in jsdom and only the first test is about its output
    ethHashInfoSpy = jest.spyOn(EthHashInfo, 'default').mockImplementation(({ name, children }) => (
      <>
        <span>{name}</span>
        {children}
      </>
    ))
    mockUseSafeInfo.mockReturnValue({
      safe: { deployed: true },
      safeAddress: '0x3DDDCE646712500aB55E1b2d6E61de4C409f50EF',
    })
  })

  it('should render a row for each associated token', async () => {
    ethHashInfoSpy.mockRestore()
    jest.spyOn(hedera, 'getHederaAssociatedTokens').mockResolvedValue({
      tokens: [
        {
          tokenId: '0.0.731861',
          evmAddress: '0x00000000000000000000000000000000000b2ad5',
          name: 'SaucerSwap',
          symbol: 'SAUCE',
          balance: 5000000,
          decimals: 6,
          freezeStatus: 'NOT_APPLICABLE',
          createdAt: new Date(),
        },
      ],
      truncated: false,
    })

    const { getByText, getByTestId } = renderTable(hedera.HederaNetwork.MAINNET)

    await waitFor(() => {
      expect(getByText('NOT_APPLICABLE')).toBeInTheDocument()
    })

    expect(getByText('6')).toBeInTheDocument()
    expect(getByText('SaucerSwap (SAUCE)')).toBeInTheDocument()
    // Raw smallest-unit balance (5000000 with 6 decimals) is shown divided by its decimals
    expect(getByText('5 SAUCE')).toBeInTheDocument()

    // Regression: the token row's explorer link must point at HashScan's /token/ path, not
    // the generic chain-config /account/ path EthHashInfo's own `hasExplorer` would build.
    expect(getByTestId('explorer-btn')).toHaveAttribute(
      'href',
      'https://hashscan.io/mainnet/token/0x00000000000000000000000000000000000b2ad5',
    )
  })

  it('should render nothing while there are no associated tokens', async () => {
    jest.spyOn(hedera, 'getHederaAssociatedTokens').mockResolvedValue({ tokens: [], truncated: false })

    const { container } = renderTable(hedera.HederaNetwork.MAINNET)

    await waitFor(() => {
      expect(container).toBeEmptyDOMElement()
    })
  })

  it('should render nothing when the network is not resolved yet', () => {
    const spy = jest.spyOn(hedera, 'getHederaAssociatedTokens')

    const { container } = renderTable(undefined)

    expect(spy).not.toHaveBeenCalled()
    expect(container).toBeEmptyDOMElement()
  })

  it('should show a note when the associated-token list is truncated', async () => {
    jest.spyOn(hedera, 'getHederaAssociatedTokens').mockResolvedValue({
      tokens: [
        {
          tokenId: '0.0.731861',
          evmAddress: '0x00000000000000000000000000000000000b2ad5',
          name: 'SaucerSwap',
          symbol: 'SAUCE',
          balance: 0,
          decimals: 6,
          freezeStatus: 'NOT_APPLICABLE',
          createdAt: new Date(),
        },
      ],
      truncated: true,
    })

    const { getByText } = renderTable(hedera.HederaNetwork.MAINNET)

    await waitFor(() => {
      expect(getByText(/this account has more/i)).toBeInTheDocument()
    })
  })

  it('should open the dissociate flow for a zero-balance token', async () => {
    jest.spyOn(hedera, 'getHederaAssociatedTokens').mockResolvedValue({
      tokens: [
        {
          tokenId: '0.0.731861',
          evmAddress: '0x00000000000000000000000000000000000b2ad5',
          name: 'SaucerSwap',
          symbol: 'SAUCE',
          balance: 0,
          decimals: 6,
          freezeStatus: 'NOT_APPLICABLE',
          createdAt: new Date(),
        },
      ],
      truncated: false,
    })

    const setTxFlow = jest.fn()
    const { getByTestId } = renderTable(hedera.HederaNetwork.MAINNET, setTxFlow)

    await waitFor(() => {
      expect(getByTestId('dissociate-token-btn')).toBeEnabled()
    })

    fireEvent.click(getByTestId('dissociate-token-btn'))

    expect(setTxFlow).toHaveBeenCalledTimes(1)
  })

  it('should disable the dissociate button while the token still has a balance', async () => {
    jest.spyOn(hedera, 'getHederaAssociatedTokens').mockResolvedValue({
      tokens: [
        {
          tokenId: '0.0.731861',
          evmAddress: '0x00000000000000000000000000000000000b2ad5',
          name: 'SaucerSwap',
          symbol: 'SAUCE',
          balance: 10,
          decimals: 6,
          freezeStatus: 'NOT_APPLICABLE',
          createdAt: new Date(),
        },
      ],
      truncated: false,
    })

    const setTxFlow = jest.fn()
    const { getByTestId } = renderTable(hedera.HederaNetwork.MAINNET, setTxFlow)

    await waitFor(() => {
      expect(getByTestId('dissociate-token-btn')).toBeDisabled()
    })

    expect(setTxFlow).not.toHaveBeenCalled()
  })

  it('should show an error with a retry button when the mirror node request fails', async () => {
    const spy = jest
      .spyOn(hedera, 'getHederaAssociatedTokens')
      .mockRejectedValueOnce(new Error('mirror node returned 503'))
      .mockResolvedValueOnce({ tokens: [buildToken('0.0.731861')], truncated: false })

    const { getByText, findByText } = renderTable(hedera.HederaNetwork.MAINNET)

    expect(await findByText(/failed to load associated tokens/i)).toBeInTheDocument()

    fireEvent.click(getByText('Try again'))

    expect(await findByText('NOT_APPLICABLE')).toBeInTheDocument()
    expect(spy).toHaveBeenCalledTimes(2)
  })

  it('should not query the mirror node while the Safe address is not loaded yet', () => {
    mockUseSafeInfo.mockReturnValue({ safe: { deployed: true }, safeAddress: '' })
    const spy = jest.spyOn(hedera, 'getHederaAssociatedTokens')

    const { container } = renderTable(hedera.HederaNetwork.MAINNET)

    expect(spy).not.toHaveBeenCalled()
    expect(container).toBeEmptyDOMElement()
  })

  it('should not query the mirror node for a counterfactual (undeployed) Safe', () => {
    mockUseSafeInfo.mockReturnValue({
      safe: { deployed: false },
      safeAddress: '0x3DDDCE646712500aB55E1b2d6E61de4C409f50EF',
    })
    const spy = jest.spyOn(hedera, 'getHederaAssociatedTokens')

    const { container } = renderTable(hedera.HederaNetwork.MAINNET)

    expect(spy).not.toHaveBeenCalled()
    expect(container).toBeEmptyDOMElement()
  })

  it('should paginate when there are more associated tokens than fit on one page', async () => {
    const tokens = Array.from({ length: 30 }, (_, i) => buildToken(`0.0.${1000 + i}`))
    jest.spyOn(hedera, 'getHederaAssociatedTokens').mockResolvedValue({ tokens, truncated: false })

    const { findByTestId, getAllByTestId } = renderTable(hedera.HederaNetwork.MAINNET)

    expect(await findByTestId('table-pagination')).toBeInTheDocument()
    expect(getAllByTestId('dissociate-token-btn')).toHaveLength(25)
  })

  it('should refetch, keeping the current rows, once a new transaction is indexed', async () => {
    const safeAddress = '0x3DDDCE646712500aB55E1b2d6E61de4C409f50EF'
    mockUseSafeInfo.mockReturnValue({ safe: { deployed: true, txHistoryTag: '1' }, safeAddress })
    const spy = jest
      .spyOn(hedera, 'getHederaAssociatedTokens')
      .mockResolvedValueOnce({ tokens: [buildToken('0.0.1')], truncated: false })
      .mockResolvedValueOnce({ tokens: [buildToken('0.0.1'), buildToken('0.0.2')], truncated: false })

    const { getAllByTestId, queryByTestId, rerender } = renderTable(hedera.HederaNetwork.MAINNET)
    await waitFor(() => expect(getAllByTestId('dissociate-token-btn')).toHaveLength(1))

    mockUseSafeInfo.mockReturnValue({ safe: { deployed: true, txHistoryTag: '2' }, safeAddress })
    rerender(
      <TxModalContext.Provider value={{ txFlow: undefined, setTxFlow: jest.fn(), setFullWidth: jest.fn() }}>
        <AssociatedTokensTable network={hedera.HederaNetwork.MAINNET} />
      </TxModalContext.Provider>,
    )

    expect(queryByTestId('associated-tokens-loading')).not.toBeInTheDocument()
    await waitFor(() => expect(getAllByTestId('dissociate-token-btn')).toHaveLength(2))
    expect(spy).toHaveBeenCalledTimes(2)
  })
})
