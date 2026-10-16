import { useContext, useEffect, useState, type ReactElement } from 'react'
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  FormControlLabel,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material'
import { asError } from '@safe-global/utils/services/exceptions/utils'
import { formatVisualAmount } from '@safe-global/utils/utils/formatters'
import { sameAddress } from '@safe-global/utils/utils/addresses'
import { useGasTokenFeeOptions } from './useGasTokenFeeOptions'
import { GasTokenFeeSummary } from './GasTokenFeeSummary'
import { SafeTxContext } from '@/components/tx-flow/SafeTxProvider'
import { TxFlowContext } from '@/components/tx-flow/TxFlowProvider'
import ErrorMessage from '@/components/tx/ErrorMessage'
import { useCurrentChain, useHasFeature } from '@/hooks/useChains'
import { useGasTokenSupport } from '@/hooks/useGasTokenSupport'
import useSafeInfo from '@/hooks/useSafeInfo'
import { createTx } from '@/services/tx/tx-sender'
import {
  NO_FEE_FIELDS,
  feeFields,
  getEstimatedFee,
  isGasTokenRelayTx,
  isNativeGasToken,
  isSafePaysTx,
} from '@/services/tx/gasTokenFee'
import { FEATURES } from '@/utils/featureToggled'
import { SlotName, withSlot } from '../slots'

export const GasTokenFee = (): ReactElement | null => {
  const chain = useCurrentChain()
  const { safe, safeAddress } = useSafeInfo()
  const { safeTx, setSafeTx, setSafeTxGas } = useContext(SafeTxContext)
  const { setIsSubmitDisabled } = useContext(TxFlowContext)
  const {
    gasToken,
    gasTokens,
    isSupported,
    refundReceiver,
    error: supportError,
    retry: retrySupport,
  } = useGasTokenSupport(safeTx?.data.gasToken)
  const [selection, setEnabled] = useState<boolean>()
  const [selectedToken, setSelectedToken] = useState<string>()
  const enabled = selection ?? isGasTokenRelayTx(safeTx, gasToken, refundReceiver)
  const [buildError, setBuildError] = useState<Error>()
  const resetting = selection === false && isSafePaysTx(safeTx)
  const {
    options,
    error: optionsError,
    loading,
    retry,
  } = useGasTokenFeeOptions(
    isSupported ? gasTokens : undefined,
    safeTx,
    chain?.chainId,
    safeAddress,
    safe.threshold,
    safe.txHistoryTag,
  )
  const selectedAddress = selectedToken ?? (enabled ? safeTx?.data.gasToken : undefined)
  const option =
    (selectedAddress ? options?.find(({ token }) => sameAddress(token.address, selectedAddress)) : undefined) ??
    (!selectedAddress
      ? (options?.find((entry) => entry.preview && !entry.insufficient && !entry.error) ?? options?.[0])
      : undefined)
  const token = option?.token ?? gasTokens?.find((entry) => sameAddress(entry.address, selectedAddress)) ?? gasToken
  const preview = option?.preview
  // The Safe refunds whole token units per gas, so a 6-decimal token rounds the fee up far above the network cost
  const coarseToken = token && token.decimals <= 6 ? token : undefined
  const finerToken = coarseToken && gasTokens?.find((entry) => entry.decimals > 6)
  const available = options?.some((entry) => entry.preview && !entry.insufficient && !entry.error)
  useEffect(() => {
    if (selection === undefined && enabled) {
      setEnabled(true)
      setSelectedToken(safeTx?.data.gasToken)
    }
  }, [selection, enabled, safeTx?.data.gasToken])
  const fields = preview ? feeFields(preview) : undefined
  const applied = !!(
    fields &&
    safeTx &&
    Object.entries(fields).every(([key, value]) => safeTx.data[key as keyof typeof fields] === value)
  )
  const error =
    supportError ??
    optionsError ??
    option?.error ??
    (!available ? options?.find((entry) => entry.error)?.error : undefined) ??
    buildError
  const pending = resetting || (enabled && (!isSupported || !applied || loading || !!error || !!option?.insufficient))

  useEffect(() => {
    setIsSubmitDisabled(pending)
    return () => setIsSubmitDisabled(false)
  }, [pending, setIsSubmitDisabled])

  useEffect(() => {
    if (!safeTx || safeTx.signatures.size > 0) return
    const nextFields = resetting
      ? NO_FEE_FIELDS
      : enabled && preview && !option?.insufficient && !applied
        ? feeFields(preview)
        : undefined
    if (!nextFields) return
    let cancelled = false
    setBuildError(undefined)
    createTx({ ...safeTx.data, ...nextFields }, safeTx.data.nonce)
      .then((tx) => {
        if (!cancelled) setSafeTx((current) => (current === safeTx ? tx : current))
      })
      .catch((cause) => {
        if (!cancelled) setBuildError(asError(cause))
      })
    return () => {
      cancelled = true
    }
  }, [enabled, preview, applied, resetting, safeTx, setSafeTx, option?.insufficient])

  const onToggle = (_: unknown, checked: boolean) => {
    setEnabled(checked)
    if (checked) setSelectedToken(token?.address)
    setBuildError(undefined)
    if (!checked) setSafeTxGas(undefined)
  }

  if (!isSupported && !supportError) return null
  return (
    <Box data-testid="gas-token-fee" sx={{ border: 1, borderColor: 'border.light', borderRadius: 1, p: 1.5 }}>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        spacing={2}
        sx={{ flexWrap: 'wrap', rowGap: 0.5 }}
      >
        <FormControlLabel
          sx={{ m: 0 }}
          labelPlacement="start"
          control={
            <Switch
              checked={enabled}
              onChange={onToggle}
              disabled={resetting || (!enabled && (!option?.preview || option.insufficient || !!error))}
            />
          }
          label="Pay from Safe"
        />
        {gasTokens && gasTokens.length > 1 ? (
          <TextField
            select
            size="small"
            label="Fee token"
            sx={{ minWidth: 130, flex: '1 1 130px', maxWidth: 220 }}
            value={token?.address ?? ''}
            SelectProps={{ renderValue: () => token?.symbol }}
            onChange={(event) => {
              setSelectedToken(event.target.value)
              setBuildError(undefined)
            }}
            disabled={!options || resetting}
          >
            {gasTokens.map((entry) => {
              const choice = options?.find(({ token }) => sameAddress(token.address, entry.address))
              return (
                <MenuItem
                  key={entry.address}
                  value={entry.address}
                  disabled={!choice?.preview || choice.insufficient || !!choice.error}
                >
                  <Box sx={{ whiteSpace: 'normal' }}>
                    <Typography variant="body2">{entry.symbol}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {choice?.balance !== undefined &&
                        `Available: ${formatVisualAmount(choice.balance, entry.decimals)} ${entry.symbol}. `}
                      {choice?.insufficient
                        ? 'Insufficient balance'
                        : choice?.error
                          ? choice.error.message
                          : choice?.preview
                            ? `Fee: ${isNativeGasToken(entry) ? 'up to ' : ''}≈ ${formatVisualAmount(getEstimatedFee(choice.preview), entry.decimals)} ${entry.symbol}`
                            : ''}
                    </Typography>
                  </Box>
                </MenuItem>
              )
            })}
          </TextField>
        ) : (
          token && <Typography variant="body2">Fee token: {token.symbol}</Typography>
        )}
      </Stack>
      {coarseToken && (
        <Alert severity="warning" sx={{ mt: 1 }}>
          {coarseToken.symbol} has 6 decimals, so the fee is rounded up and can be tens of times higher than the network
          cost.{finerToken && ` Pay in ${finerToken.symbol} for a lower fee.`}
        </Alert>
      )}
      {option?.balance !== undefined && token && (
        <Typography variant="body2" color="text.secondary" mt={0.5}>
          Available: {formatVisualAmount(option.balance, token.decimals)} {token.symbol}
        </Typography>
      )}
      {enabled && preview && token && !loading && <GasTokenFeeSummary data={preview.txData} token={token} />}
      {((!options && !error) || loading) && (
        <Stack direction="row" spacing={1} alignItems="center" mt={1}>
          <CircularProgress size={16} />
          <Typography variant="body2">Checking balances and fees…</Typography>
        </Stack>
      )}
      {option?.insufficient && enabled ? (
        <Typography variant="body2" color="error.main" mt={1}>
          Not enough {token?.symbol} for the transaction and fee. Choose another token or turn off payment from Safe.
        </Typography>
      ) : (
        options &&
        !available &&
        options.every((entry) => entry.insufficient) &&
        !error && (
          <Typography variant="body2" color="text.secondary" mt={1}>
            Add {gasTokens?.map((entry) => entry.symbol).join(' or ')} to this Safe to cover the transaction and fee.
          </Typography>
        )
      )}
      {error && (
        <ErrorMessage error={error}>
          Couldn’t load balances or estimate the fee. Retry or turn off payment from Safe.
        </ErrorMessage>
      )}
      <Button
        size="small"
        onClick={() => {
          setBuildError(undefined)
          if (supportError) retrySupport()
          else retry()
        }}
        disabled={loading}
        sx={{ mt: 1 }}
      >
        Refresh balances and fees
      </Button>
    </Box>
  )
}

const useShouldRegisterSlot = () => {
  const { isCreation, isRejection } = useContext(TxFlowContext)
  const { safeTx } = useContext(SafeTxContext)
  const hasFeature = useHasFeature(FEATURES.PAY_FROM_SAFE)
  return !!hasFeature && isCreation && !isRejection && (!safeTx || safeTx.signatures.size === 0)
}

export default withSlot({
  Component: GasTokenFee,
  slotName: SlotName.Main,
  id: 'gasTokenFee',
  useSlotCondition: useShouldRegisterSlot,
})
