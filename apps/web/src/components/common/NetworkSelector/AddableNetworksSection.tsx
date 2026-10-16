import ChainIndicator from '@/components/common/ChainIndicator'
import Track from '@/components/common/Track'
import { CreateSafeOnSpecificChain } from '@/features/multichain'
import { type Chain } from '@safe-global/store/gateway/AUTO_GENERATED/chains'
import PlusIcon from '@/public/images/common/plus.svg'
import useAddressBook from '@/hooks/useAddressBook'
import { InfoOutlined } from '@mui/icons-material'
import { Box, CircularProgress, Collapse, MenuItem, Skeleton, Stack, Tooltip, Typography } from '@mui/material'
import { type ReactElement, type ReactNode, useState } from 'react'
import { OVERVIEW_EVENTS, OVERVIEW_LABELS, trackEvent } from '@/services/analytics'
import css from './styles.module.css'
import NetworkSectionHeader from './NetworkSectionHeader'
import NewNetworkChip from './NewNetworkChip'
import { renderNetworkGroups } from './renderNetworkGroups'
import type { GroupedFilteredChains } from './utils'
import type { AsyncResult } from '@safe-global/utils/hooks/useAsync'
import type { ReplayedSafeProps } from '@safe-global/utils/features/counterfactual/store/types'

const UndeployedNetworkMenuItem = ({
  chain,
  isSelected = false,
  onSelect,
}: {
  chain: Chain & { available: boolean }
  isSelected?: boolean
  onSelect: (chain: Chain) => void
}) => {
  const isDisabled = !chain.available

  return (
    <Track {...OVERVIEW_EVENTS.ADD_NEW_NETWORK} label={OVERVIEW_LABELS.top_bar}>
      <Tooltip data-testid="add-network-tooltip" title="Add network" arrow placement="left">
        <MenuItem
          value={chain.chainId}
          sx={{ overflow: 'hidden', '&:hover': { backgroundColor: 'inherit' } }}
          onClick={() => onSelect(chain)}
          disabled={isDisabled}
        >
          <Box className={css.item}>
            <ChainIndicator responsive={isSelected} chainId={chain.chainId} inline className={css.chainIndicator} />
            {!isDisabled && <NewNetworkChip chain={chain} />}
            {isDisabled ? (
              <Typography variant="caption" component="span" className={css.comingSoon}>
                Not available
              </Typography>
            ) : (
              <PlusIcon className={css.plusIcon} />
            )}
          </Box>
        </MenuItem>
      </Tooltip>
    </Track>
  )
}

const NetworkSkeleton = () => (
  <Stack direction="row" spacing={1} sx={{ alignItems: 'center', p: '4px 0px' }}>
    <Skeleton variant="circular" width="24px" height="24px" />
    <Skeleton variant="rounded" sx={{ flexGrow: 1 }} />
  </Stack>
)

const NetworkListSkeleton = () => (
  <Box sx={{ p: '0px 16px' }}>
    <NetworkSkeleton />
    <NetworkSkeleton />
  </Box>
)

const getAddNetworkErrorContent = ({
  safeCreationDataError,
  safeCreationData,
  noAvailableNetworks,
  isUnsupportedSafeCreationVersion,
}: {
  safeCreationDataError: Error | undefined
  safeCreationData: ReplayedSafeProps | undefined
  noAvailableNetworks: boolean
  isUnsupportedSafeCreationVersion: boolean
}): ReactNode | null => {
  if (safeCreationDataError || (safeCreationData && noAvailableNetworks)) {
    return (
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
        {safeCreationDataError?.message && (
          <Tooltip title={safeCreationDataError.message}>
            <InfoOutlined color="info" fontSize="medium" />
          </Tooltip>
        )}
        <Typography component="span">Adding another network is not possible for this Safe.</Typography>
      </Stack>
    )
  }

  if (isUnsupportedSafeCreationVersion && safeCreationData) {
    return 'This account was created from an outdated mastercopy. Adding another network is not possible.'
  }

  return null
}

type AddableNetworksSectionProps = {
  isSearching: boolean
  groupedNetworks: GroupedFilteredChains<Chain & { available: boolean }>
  safeAddress: string
  closeNetworkSelect: () => void
  safeCreationResult: AsyncResult<ReplayedSafeProps>
  isUnsupportedSafeCreationVersion: boolean
  noAvailableNetworks: boolean
}

const AddableNetworksSection = ({
  isSearching,
  groupedNetworks,
  safeAddress,
  closeNetworkSelect,
  safeCreationResult,
  isUnsupportedSafeCreationVersion,
  noAvailableNetworks,
}: AddableNetworksSectionProps): ReactElement | null => {
  const [open, setOpen] = useState(false)
  const [replayOnChain, setReplayOnChain] = useState<Chain>()
  const addressBook = useAddressBook()
  const safeName = addressBook[safeAddress]

  const [safeCreationData, safeCreationDataError, safeCreationLoading] = safeCreationResult

  const errorContent = safeCreationLoading
    ? null
    : getAddNetworkErrorContent({
        safeCreationDataError,
        safeCreationData,
        noAvailableNetworks,
        isUnsupportedSafeCreationVersion,
      })

  if (errorContent) {
    return (
      <Box sx={{ px: 2, py: 1 }}>
        <Typography sx={{ color: 'text.secondary', fontSize: '14px', maxWidth: 300 }}>{errorContent}</Typography>
      </Box>
    )
  }

  if (isSearching && !groupedNetworks.hasResults && !safeCreationLoading) {
    return null
  }

  const onFormClose = () => {
    setReplayOnChain(undefined)
    closeNetworkSelect()
  }

  const onShowAllNetworks = () => {
    !open && trackEvent(OVERVIEW_EVENTS.SHOW_ALL_NETWORKS)
    setOpen((prev) => !prev)
  }

  const networkList = safeCreationLoading ? (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 1 }}>
      <CircularProgress size={18} />
    </Box>
  ) : safeCreationData ? (
    renderNetworkGroups(groupedNetworks, (chain) => (
      <UndeployedNetworkMenuItem chain={chain} onSelect={setReplayOnChain} key={chain.chainId} />
    ))
  ) : (
    <NetworkListSkeleton />
  )

  return (
    <>
      {isSearching ? (
        <>
          <NetworkSectionHeader label="Other networks" isLoading={safeCreationLoading} />
          {networkList}
        </>
      ) : (
        <>
          <NetworkSectionHeader
            label="Show all networks"
            onToggle={onShowAllNetworks}
            isExpanded={open}
            isLoading={safeCreationLoading && !open}
            testId="show-all-networks"
          />
          <Collapse in={open} timeout="auto" unmountOnExit>
            {networkList}
          </Collapse>
        </>
      )}
      {replayOnChain && safeCreationData && (
        <CreateSafeOnSpecificChain
          chain={replayOnChain}
          safeAddress={safeAddress}
          open
          onClose={onFormClose}
          currentName={safeName ?? ''}
          safeCreationResult={safeCreationResult}
        />
      )}
    </>
  )
}

export default AddableNetworksSection
