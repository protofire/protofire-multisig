import ClearSigningIcon from '@/public/images/common/search.svg'
import InfoIcon from '@/public/images/notifications/info.svg'
import {
  getClearSigningEntryLabel,
  useClearSigningLookupSummary,
  type ClearSigningLookupSummary,
} from '@/features/erc7730'
import { Box, Collapse, IconButton, Stack, SvgIcon, Tooltip, Typography } from '@mui/material'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import { type ReactElement, useEffect, useState } from 'react'

interface ClearSigningLookupCardProps {
  delay?: number
}

const LOOKUP_TOOLTIP =
  'Look up a public registry descriptor for human-readable call details. This does not verify the transaction.'

const getHeaderSubtitle = ({
  doneCount,
  foundCount,
  isMultiAction,
  primaryEntry,
  eligibleKeyedEntries,
}: ClearSigningLookupSummary): string | undefined => {
  if (doneCount === 0) {
    return isMultiAction ? `${eligibleKeyedEntries.length} actions` : undefined
  }

  if (!isMultiAction) {
    return getClearSigningEntryLabel(primaryEntry.entry)
  }

  const foundSuffix = foundCount > 0 ? ` · ${foundCount} found` : ''
  return `${doneCount}/${eligibleKeyedEntries.length} checked${foundSuffix}`
}

const LookupButton = ({
  label,
  disabled = false,
  onClick,
  testId,
}: {
  label: string
  disabled?: boolean
  onClick: () => void
  testId: string
}): ReactElement => (
  <Box
    component="button"
    type="button"
    data-testid={testId}
    disabled={disabled}
    onClick={(event) => {
      event.stopPropagation()
      onClick()
    }}
    sx={{
      backgroundColor: 'background.lightGrey',
      border: 'none',
      borderRadius: '4px',
      px: 1,
      py: 0.25,
      flexShrink: 0,
      cursor: disabled ? 'default' : 'pointer',
      '&:hover': {
        backgroundColor: disabled ? 'background.lightGrey' : 'border.light',
      },
    }}
  >
    <Typography color="text.primary" sx={{ fontSize: '12px', lineHeight: '2.015', letterSpacing: '0.4px' }}>
      {label}
    </Typography>
  </Box>
)

export const ClearSigningLookupCard = ({ delay = 0 }: ClearSigningLookupCardProps): ReactElement | null => {
  const summary = useClearSigningLookupSummary()
  const isMultiAction = summary?.isMultiAction ?? false
  const [isVisible, setIsVisible] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)

  useEffect(() => {
    const timeout = setTimeout(() => setIsVisible(true), delay)
    return () => clearTimeout(timeout)
  }, [delay])

  if (!summary) {
    return null
  }

  const { lookupContext, eligibleKeyedEntries, isAnyLoading, allDone, requestLookups } = summary
  const subtitle = getHeaderSubtitle(summary)
  const runLabel = isAnyLoading ? 'Looking up…' : isMultiAction ? 'Look up all' : 'Look up'
  const runButton = !allDone && (
    <LookupButton testId="erc7730-lookup-run-btn" label={runLabel} disabled={isAnyLoading} onClick={requestLookups} />
  )

  return (
    <Box
      data-testid="erc7730-lookup-card"
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
        sx={{ padding: '12px', cursor: isMultiAction ? 'pointer' : 'default' }}
        onClick={isMultiAction ? () => setIsExpanded(!isExpanded) : undefined}
      >
        <Stack direction="row" alignItems="center" gap={1} minWidth={0}>
          <SvgIcon
            component={ClearSigningIcon}
            inheritViewBox
            sx={{
              fontSize: 16,
              color: ({ palette }) => (palette.mode === 'dark' ? palette.primary.main : palette.secondary.main),
            }}
          />
          <Stack minWidth={0}>
            <Stack direction="row" alignItems="center" gap={0.5}>
              <Typography variant="body2" color="primary.light" noWrap>
                ERC-7730 lookup
              </Typography>
              {!isAnyLoading && (
                <Tooltip
                  title={
                    <Typography variant="body2" textAlign="center">
                      {LOOKUP_TOOLTIP}
                    </Typography>
                  }
                  arrow
                  placement="top"
                >
                  <Box component="span" display="flex">
                    <SvgIcon component={InfoIcon} inheritViewBox color="border" sx={{ fontSize: 14 }} />
                  </Box>
                </Tooltip>
              )}
            </Stack>
            {subtitle && (
              <Typography variant="caption" color="text.secondary" noWrap>
                {subtitle}
              </Typography>
            )}
          </Stack>
        </Stack>

        <Stack direction="row" alignItems="center" gap={1} flexShrink={0}>
          {runButton}
          {isMultiAction && (
            <IconButton
              size="small"
              sx={{
                width: 16,
                height: 16,
                padding: 0,
                transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s',
              }}
            >
              <KeyboardArrowDownIcon sx={{ width: 16, height: 16, color: 'text.secondary' }} />
            </IconButton>
          )}
        </Stack>
      </Stack>

      {isMultiAction && (
        <Collapse in={isExpanded}>
          <Stack gap={1} sx={{ padding: '4px 12px 16px', maxHeight: 320, overflowY: 'auto' }}>
            {eligibleKeyedEntries.map(({ key, entry }) => (
              <Stack
                key={key}
                direction="row"
                justifyContent="space-between"
                alignItems="center"
                gap={1}
                sx={{ px: 1.5, py: 1, borderRadius: 1, bgcolor: 'background.main' }}
              >
                <Typography variant="body2" color="text.primary" noWrap sx={{ minWidth: 0 }}>
                  {entry.label}
                </Typography>
                {entry.status === 'idle' ? (
                  <LookupButton
                    testId={`erc7730-lookup-run-btn-${key}`}
                    label="Look up"
                    onClick={() => lookupContext.requestLookup(key)}
                  />
                ) : (
                  <Typography variant="caption" color="primary.main" sx={{ flexShrink: 0 }}>
                    {getClearSigningEntryLabel(entry) ?? 'Not looked up'}
                  </Typography>
                )}
              </Stack>
            ))}
          </Stack>
        </Collapse>
      )}
    </Box>
  )
}
