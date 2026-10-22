import { useContext } from 'react'
import { Paper, Grid, Typography, Box, Button } from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import { useCurrentChain } from '@/hooks/useChains'
import { getHederaNetwork } from '@/utils/hedera'
import { AssociateTokenFlow } from '@/components/tx-flow/flows'
import CheckWallet from '@/components/common/CheckWallet'
import { TxModalContext } from '@/components/tx-flow'
import AssociatedTokensTable from './AssociatedTokensTable'

/**
 * Hedera-only: no account (including a Safe) can hold an HTS token without first explicitly
 * associating with it — there's no receiver-hook equivalent to `onERC721Received` that would let
 * a Safe auto-associate on first contact. ERC20/721 tokens don't need such step.
 */
export const TokenAssociation = () => {
  const { setTxFlow } = useContext(TxModalContext)
  const network = getHederaNetwork(useCurrentChain())

  if (!network) {
    return null
  }

  return (
    <Paper data-testid="token-association-section" sx={{ padding: 4 }}>
      <Grid container direction="row" spacing={3} sx={{ justifyContent: 'space-between' }}>
        <Grid item lg={4} xs={12}>
          <Typography variant="h4" fontWeight={700}>
            Token Association
          </Typography>
        </Grid>

        <Grid item xs>
          <Box>
            <Typography>
              You can associate HTS tokens. This is necessary to receive HTS tokens and is not needed for ERC20/721
              tokens.
            </Typography>

            <CheckWallet>
              {(isOk) => (
                <Button
                  data-testid="associate-token"
                  onClick={() => setTxFlow(<AssociateTokenFlow />)}
                  sx={{ mt: 2 }}
                  variant="text"
                  disabled={!isOk}
                  startIcon={<AddIcon />}
                >
                  Associate Token
                </Button>
              )}
            </CheckWallet>

            <AssociatedTokensTable network={network} />
          </Box>
        </Grid>
      </Grid>
    </Paper>
  )
}

export default TokenAssociation
