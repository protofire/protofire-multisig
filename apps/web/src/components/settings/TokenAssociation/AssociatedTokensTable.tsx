import { useContext, useMemo, useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { Box, Button, IconButton, Skeleton, SvgIcon, Tooltip, Typography } from '@mui/material'
import useAsync from '@safe-global/utils/hooks/useAsync'
import { formatVisualAmount } from '@safe-global/utils/utils/formatters'
import EnhancedTable from '@/components/common/EnhancedTable'
import tableCss from '@/components/common/EnhancedTable/styles.module.css'
import EthHashInfo from '@/components/common/EthHashInfo'
import ExplorerButton from '@/components/common/ExplorerButton'
import CheckWallet from '@/components/common/CheckWallet'
import ErrorMessage from '@/components/tx/ErrorMessage'
import DeleteIcon from '@/public/images/common/delete.svg'
import { TxModalContext } from '@/components/tx-flow'
import { DissociateTokenFlow } from '@/components/tx-flow/flows'
import useSafeInfo from '@/hooks/useSafeInfo'
import { getHederaAssociatedTokens, getHederaTokenExplorerLink, type HederaNetwork } from '@/utils/hedera'

const headCells = [
  { id: 'token', label: 'Token' },
  { id: 'balance', label: 'Balance' },
  { id: 'decimals', label: 'Decimals' },
  { id: 'freezeStatus', label: 'Freeze Status' },
  { id: 'created', label: 'Created' },
  { id: 'actions', label: '', disableSort: true },
]

const AssociatedTokensTable = ({ network }: { network?: HederaNetwork }) => {
  const { safe, safeAddress } = useSafeInfo()
  const { setTxFlow } = useContext(TxModalContext)
  const [retryCount, setRetryCount] = useState(0)

  const [result, error, loading] = useAsync(
    () => {
      // An empty safeAddress (Safe info still loading) or a counterfactual Safe has no mirror node
      // account yet — querying it would only ever 404
      if (!network || !safeAddress || !safe.deployed) return
      return getHederaAssociatedTokens(network, safeAddress)
    },
    // txHistoryTag changes once an executed (dis)association is indexed — the gateway reads Hedera
    // through the mirror-node-backed JSON-RPC relay, so the mirror node already has it by then
    [network, safeAddress, safe.deployed, safe.txHistoryTag, retryCount],
    // Keep the current rows while refetching, rather than flashing the skeleton on every new tx
    false,
  )

  const tokens = result?.tokens

  const rows = useMemo(
    () =>
      (tokens ?? []).map((token) => {
        // Hedera requires an account's balance of a token to be zero before it can dissociate —
        // a non-zero balance makes the dissociation revert on-chain, so block it here rather than
        // let the user submit a transaction that's guaranteed to fail.
        const canDissociate = token.balance === 0

        return {
          key: token.tokenId,
          cells: {
            token: {
              rawValue: token.symbol || token.tokenId,
              content: (
                <EthHashInfo
                  address={token.evmAddress}
                  name={token.symbol ? `${token.name} (${token.symbol})` : token.name || token.tokenId}
                  showAvatar={false}
                  showCopyButton
                >
                  {network && (
                    <ExplorerButton
                      title="View token on HashScan"
                      href={getHederaTokenExplorerLink(network, token.evmAddress)}
                    />
                  )}
                </EthHashInfo>
              ),
            },
            balance: {
              rawValue: token.balance / 10 ** token.decimals,
              content: `${formatVisualAmount(BigInt(token.balance), token.decimals)} ${token.symbol}`.trim(),
            },
            decimals: { rawValue: token.decimals, content: token.decimals },
            freezeStatus: { rawValue: token.freezeStatus, content: token.freezeStatus },
            created: {
              rawValue: token.createdAt.getTime(),
              content: formatDistanceToNow(token.createdAt, { addSuffix: true }),
            },
            actions: {
              rawValue: null,
              sticky: true,
              content: (
                <div className={tableCss.actions}>
                  <CheckWallet>
                    {(isOk) => (
                      <Tooltip title={canDissociate ? '' : 'This token still has a balance — transfer it out first'}>
                        <span>
                          <IconButton
                            data-testid="dissociate-token-btn"
                            onClick={() => setTxFlow(<DissociateTokenFlow token={token} />)}
                            color="error"
                            size="small"
                            disabled={!isOk || !canDissociate}
                            title="Dissociate token"
                          >
                            <SvgIcon component={DeleteIcon} inheritViewBox color="error" fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                    )}
                  </CheckWallet>
                </div>
              ),
            },
          },
        }
      }),
    [tokens, network, setTxFlow],
  )

  if (loading && !result) {
    return <Skeleton data-testid="associated-tokens-loading" variant="rounded" height={120} sx={{ mt: 2 }} />
  }

  if (error) {
    return (
      <Box mt={2}>
        <ErrorMessage error={error}>
          Failed to load associated tokens.{' '}
          <Button size="small" onClick={() => setRetryCount((count) => count + 1)}>
            Try again
          </Button>
        </ErrorMessage>
      </Box>
    )
  }

  if (rows.length === 0) return null

  return (
    <>
      <EnhancedTable rows={rows} headCells={headCells} />
      {result?.truncated && (
        <Typography variant="body2" color="text.secondary" mt={1}>
          Showing the first {rows.length} associated tokens — this account has more.
        </Typography>
      )}
    </>
  )
}

export default AssociatedTokensTable
