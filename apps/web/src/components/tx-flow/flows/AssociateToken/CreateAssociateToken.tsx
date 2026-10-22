import { useContext, useState, type ReactElement } from 'react'
import { Box, Button, CardActions, Divider, TextField, Typography } from '@mui/material'
import useAsync from '@safe-global/utils/hooks/useAsync'
import useDebounce from '@safe-global/utils/hooks/useDebounce'
import TxCard from '@/components/tx-flow/common/TxCard'
import { TxFlowContext, type TxFlowContextType } from '@/components/tx-flow/TxFlowProvider'
import { useCurrentChain } from '@/hooks/useChains'
import useSafeInfo from '@/hooks/useSafeInfo'
import {
  getHederaNetwork,
  getHederaTokenMetadata,
  isHederaTokenAssociated,
  isHederaAccountId,
  type HederaTokenMetadata,
} from '@/utils/hedera'
import { isAddress } from 'ethers'
import type { AssociateTokenParams } from '.'

const CreateAssociateToken = (): ReactElement => {
  const { onNext, data } = useContext(TxFlowContext) as TxFlowContextType<AssociateTokenParams>
  const network = getHederaNetwork(useCurrentChain())
  const { safeAddress } = useSafeInfo()

  const [value, setValue] = useState(data?.token?.tokenId ?? '')
  const debouncedValue = useDebounce(value.trim(), 300)
  const isValidFormat = isHederaAccountId(debouncedValue) || isAddress(debouncedValue)

  // Resolves and fully validates the token live, as soon as a valid address/account id is typed
  // — no button click needed. `useAsync` catches both validation failures below (thrown as plain
  // Errors) and genuine mirror-node fetch errors into the same `resolveError` slot.
  const [token, resolveError, isResolving] = useAsync<HederaTokenMetadata | undefined>(async () => {
    if (!network || !safeAddress || !isValidFormat) return

    const resolved = await getHederaTokenMetadata(network, debouncedValue)
    if (resolved.deleted) {
      throw new Error('This token has been deleted and can no longer be associated')
    }

    if (await isHederaTokenAssociated(network, safeAddress, resolved.tokenId)) {
      throw new Error('The token address is already associated with this Safe account')
    }

    return resolved
  }, [network, debouncedValue, isValidFormat, safeAddress])

  const errorMessage =
    debouncedValue && !isValidFormat
      ? 'Enter a valid token address (0x...) or token id (0.0.xxx)'
      : resolveError?.message

  return (
    <TxCard>
      <Typography>Review the token you want to associate with your Safe.</Typography>

      <TextField
        label="Token address or token ID (0.0.xxx)"
        error={!!errorMessage}
        helperText={errorMessage}
        fullWidth
        value={value}
        onChange={(e) => setValue(e.target.value)}
        InputLabelProps={{ shrink: true }}
      />

      <Box>
        <Divider sx={{ mx: -3, mt: 2 }} />

        <CardActions>
          <Button variant="contained" onClick={() => token && onNext({ token })} disabled={!token || isResolving}>
            Next
          </Button>
        </CardActions>
      </Box>
    </TxCard>
  )
}

export default CreateAssociateToken
