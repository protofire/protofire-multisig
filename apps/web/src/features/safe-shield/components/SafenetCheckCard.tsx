import { type ReactElement, type ReactNode, useCallback, useContext, useMemo, useState } from 'react'
import { Box, Collapse, Stack, SvgIcon, Tooltip, Typography } from '@mui/material'
import ShieldIcon from '@/public/images/common/shield.svg'
import InfoIcon from '@/public/images/notifications/info.svg'
import { TxFlowContext } from '@/components/tx-flow/TxFlowProvider'
import useSafeInfo from '@/hooks/useSafeInfo'
import { useHasFeature } from '@/hooks/useChains'
import { useLoadFeature } from '@/features/__core__'
import { FEATURES } from '@safe-global/utils/utils/chains'
import { isMultisigDetailedExecutionInfo } from '@/utils/transaction-guards'
import { useSafenetCheck } from '@safe-global/utils/features/safenet-checks/hooks'
import { SAFENET_PROXY_URL } from '@safe-global/utils/features/safenet-checks/constants'
import { CheckStatus } from '@safe-global/utils/features/safenet-checks/types/status'
import { SafenetChecksFeature, getStatusCopy, useRequestSafenetCheck } from '@/features/safenet-checks'
import { ExpandChevron } from './ExpandChevron'
import { LookupButton } from './LookupButton'
import { useDelayedVisibility } from '../hooks/useDelayedVisibility'

const TOOLTIP = 'Independent Safenet sentinels simulate the transaction and attest a verdict on Gnosis Chain.'
const QUEUE_ONLY = 'Available once signed and queued'

const Row = ({
  delay,
  subtitle,
  subtitleColor = 'text.secondary',
  action,
  isExpanded = false,
  onToggle,
  children,
}: {
  delay: number
  subtitle: string
  subtitleColor?: string
  action?: ReactElement | false
  isExpanded?: boolean
  onToggle?: () => void
  children?: ReactNode
}): ReactElement => {
  const isVisible = useDelayedVisibility(delay)

  return (
    <Box
      data-testid="safenet-check-card"
      sx={{
        overflow: 'hidden',
        opacity: isVisible ? 1 : 0,
        maxHeight: isVisible ? 1000 : 0,
        transition: 'opacity 0.3s ease-in-out, max-height 0.3s ease-in-out',
        transitionDelay: `${delay}ms`,
      }}
    >
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        sx={{ padding: '12px', cursor: onToggle ? 'pointer' : 'default' }}
        onClick={onToggle}
      >
        <Stack direction="row" alignItems="center" gap={1} minWidth={0}>
          <SvgIcon
            component={ShieldIcon}
            inheritViewBox
            sx={{
              fontSize: 16,
              color: ({ palette }) => (palette.mode === 'dark' ? palette.primary.main : palette.secondary.main),
            }}
          />
          <Stack minWidth={0}>
            <Stack direction="row" alignItems="center" gap={0.5}>
              <Typography variant="body2" color="primary.light" noWrap>
                Safenet check
              </Typography>
              <Tooltip
                title={
                  <Typography variant="body2" textAlign="center">
                    {TOOLTIP}
                  </Typography>
                }
                arrow
                placement="top"
              >
                <Box component="span" display="flex">
                  <SvgIcon component={InfoIcon} inheritViewBox color="border" sx={{ fontSize: 14 }} />
                </Box>
              </Tooltip>
            </Stack>
            <Typography variant="caption" color={subtitleColor} noWrap data-testid="safenet-check-status">
              {subtitle}
            </Typography>
          </Stack>
        </Stack>

        <Stack direction="row" alignItems="center" gap={1} flexShrink={0}>
          {action}
          {onToggle && <ExpandChevron isExpanded={isExpanded} />}
        </Stack>
      </Stack>

      {children && (
        <Collapse in={isExpanded} mountOnEnter unmountOnExit>
          <Box sx={{ padding: '0 12px 12px' }}>{children}</Box>
        </Collapse>
      )}
    </Box>
  )
}

const QueuedCheck = ({
  safeTxHash,
  submittedAt,
  delay,
}: {
  safeTxHash: string
  submittedAt?: number
  delay: number
}): ReactElement => {
  const { safe } = useSafeInfo()
  const { SafenetCheckSection } = useLoadFeature(SafenetChecksFeature)
  const chainId = safe.chainId
  const safeAddress = safe.address.value
  const target = useMemo(() => ({ chainId, safeAddress }), [chainId, safeAddress])
  const { publicStatus, unavailableReason, isRequested } = useSafenetCheck(safeTxHash, submittedAt, target)
  const { request, state } = useRequestSafenetCheck({ ...target, safeTxHash })
  const [isExpanded, setIsExpanded] = useState(false)

  const copy = getStatusCopy(publicStatus, unavailableReason)
  const isUnavailable = publicStatus === CheckStatus.UNAVAILABLE
  const hasVerdict = !!copy && !isUnavailable
  const hasDetails = hasVerdict || isRequested || unavailableReason === 'READ_FAILED'
  const canRequest = !!SAFENET_PROXY_URL && !!copy && isUnavailable && !hasDetails

  const subtitle = hasVerdict
    ? copy.chip
    : isRequested
      ? 'Requested'
      : state === 'failed'
        ? 'Request failed'
        : (copy?.chip ?? 'Checking…')

  const onRequest = useCallback(async () => {
    await request()
    setIsExpanded(true)
  }, [request])

  return (
    <Row
      delay={delay}
      subtitle={subtitle}
      subtitleColor={hasVerdict ? `${copy.severity}.main` : 'text.secondary'}
      isExpanded={isExpanded}
      onToggle={hasDetails ? () => setIsExpanded((prev) => !prev) : undefined}
      action={
        canRequest && (
          <LookupButton
            testId="safenet-check-run-btn"
            label={state === 'requesting' ? 'Checking…' : 'Check'}
            disabled={state === 'requesting'}
            onClick={onRequest}
          />
        )
      }
    >
      {hasDetails && (
        <SafenetCheckSection
          safeTxHash={safeTxHash}
          chainId={target.chainId}
          safeAddress={target.safeAddress}
          submittedAt={submittedAt}
          canRequestCheck={false}
        />
      )}
    </Row>
  )
}

export const SafenetCheckCard = ({ delay = 0 }: { delay?: number }): ReactElement | null => {
  const isEnabled = useHasFeature(FEATURES.SAFENET_CHECKS) === true
  const { txId, txDetails } = useContext(TxFlowContext)

  if (!isEnabled) return null
  if (!txId) return <Row delay={delay} subtitle={QUEUE_ONLY} />

  const executionInfo = txDetails?.detailedExecutionInfo
  if (!isMultisigDetailedExecutionInfo(executionInfo)) return null

  return <QueuedCheck safeTxHash={executionInfo.safeTxHash} submittedAt={executionInfo.submittedAt} delay={delay} />
}
