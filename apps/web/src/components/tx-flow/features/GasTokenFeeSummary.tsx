import { useState } from 'react'
import { Box, IconButton, Stack, Tooltip, Typography } from '@mui/material'
import InfoOutlined from '@mui/icons-material/InfoOutlined'
import { formatVisualAmount } from '@safe-global/utils/utils/formatters'
import { getEstimatedFee, isNativeGasToken, type FeePreview, type GasToken } from '@/services/tx/gasTokenFee'

export const GasTokenFeeSummary = ({
  data,
  token,
}: {
  data: Pick<FeePreview['txData'], 'safeTxGas' | 'baseGas' | 'gasPrice'>
  token: GasToken
}) => {
  const [showExplanation, setShowExplanation] = useState(false)
  // For the native coin the contract refunds at most this; the real gas price caps it
  const upTo = isNativeGasToken(token) ? 'up to ' : ''
  const amount = formatVisualAmount(getEstimatedFee({ txData: data }), token.decimals)
  return (
    <Box sx={{ pt: 1, pb: 0.5 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
        <Typography variant="body2">Estimated fee</Typography>
        <Stack direction="row" alignItems="center">
          <Typography variant="body2">
            {upTo}≈ {amount} {token.symbol}
          </Typography>
          <Tooltip
            open={showExplanation}
            onOpen={() => setShowExplanation(true)}
            onClose={() => setShowExplanation(false)}
            title={`${upTo ? 'Up to' : 'Approximately'} ${amount} ${token.symbol} will be deducted from this Safe to cover execution. The relayer pays network gas upfront. Your connected wallet pays no network fee. The final charge may differ.`}
            arrow
          >
            <IconButton
              size="small"
              aria-label="How transaction fees are paid"
              onClick={() => setShowExplanation((value) => !value)}
            >
              <InfoOutlined fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      </Stack>
      <Typography variant="body2" color="text.secondary" mt={0.5}>
        Paid from this Safe’s {token.symbol} balance.
      </Typography>
      <Typography variant="body2" color="text.secondary">
        No network fee from your connected wallet.
      </Typography>
    </Box>
  )
}
