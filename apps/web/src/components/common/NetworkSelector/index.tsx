import ChainIndicator from '@/components/common/ChainIndicator'
import { useDarkMode } from '@/hooks/useDarkMode'
import { useTheme } from '@mui/material/styles'
import Link from 'next/link'
import { MenuItem, Select, Skeleton } from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/KeyboardArrowDownRounded'
import useChains, { useCurrentChain } from '@/hooks/useChains'
import type { NextRouter } from 'next/router'
import { useRouter } from 'next/router'
import css from './styles.module.css'
import { type ReactElement, useCallback, useMemo, useState } from 'react'
import { OVERVIEW_EVENTS, OVERVIEW_LABELS, trackEvent } from '@/services/analytics'
import { useAllSafesGrouped } from '@/hooks/safes'
import useSafeAddress from '@/hooks/useSafeAddress'
import { sameAddress } from '@safe-global/utils/utils/addresses'
import uniq from 'lodash/uniq'
import { hasMultiChainAddNetworkFeature } from '@/features/multichain'
import { type Chain } from '@safe-global/store/gateway/AUTO_GENERATED/chains'
import useChainId from '@/hooks/useChainId'
import AddableNetworksSection from './AddableNetworksSection'
import NetworkMenuSearch from './NetworkMenuSearch'
import NetworkSectionHeader from './NetworkSectionHeader'
import NoNetworksFound from './NoNetworksFound'
import NewNetworkChip from './NewNetworkChip'
import { renderNetworkGroups } from './renderNetworkGroups'
import { useAddableNetworks } from './useAddableNetworks'
import { useNetworkSearch } from './useNetworkSearch'
import { getGroupedFilteredChains } from './utils'

export const getNetworkLink = (
  router: NextRouter,
  safeAddress: string,
  chainInfo: Pick<Chain, 'chainId' | 'shortName'>,
) => {
  const { shortName } = chainInfo
  const isSafeOpened = safeAddress !== ''

  const query = (
    isSafeOpened
      ? {
          safe: `${shortName}:${safeAddress}`,
        }
      : { chain: shortName }
  ) as {
    safe?: string
    chain?: string
    safeViewRedirectURL?: string
    appUrl?: string
  }

  const route = {
    pathname: router.pathname,
    query,
  }

  const queryParams = ['safeViewRedirectURL', 'appUrl'] as const

  for (const key of queryParams) {
    if (router.query?.[key]) {
      route.query[key] = router.query?.[key].toString()
    }
  }

  return route
}

const NetworkSelector = ({
  onChainSelect,
  offerSafeCreation = false,
  compactButton = false,
}: {
  onChainSelect?: () => void
  offerSafeCreation?: boolean
  compactButton?: boolean
}): ReactElement => {
  const [open, setOpen] = useState<boolean>(false)
  const isDarkMode = useDarkMode()
  const theme = useTheme()
  const { configs } = useChains()
  const chainId = useChainId()
  const router = useRouter()
  const safeAddress = useSafeAddress()
  const currentChain = useCurrentChain()
  const isSafeOpened = safeAddress !== ''

  const addNetworkFeatureEnabled = hasMultiChainAddNetworkFeature(currentChain)
  const showAddableNetworks = offerSafeCreation && isSafeOpened && addNetworkFeatureEnabled

  const safesGrouped = useAllSafesGrouped()
  const availableChainIds = useMemo(() => {
    if (!isSafeOpened) {
      // Offer all chains
      return configs.map((config) => config.chainId)
    }
    return uniq([
      chainId,
      ...(safesGrouped.allMultiChainSafes
        ?.find((item) => sameAddress(item.address, safeAddress))
        ?.safes.map((safe) => safe.chainId) ?? []),
    ])
  }, [chainId, configs, isSafeOpened, safeAddress, safesGrouped.allMultiChainSafes])

  const availableChains = useMemo(
    () => configs.filter((config) => availableChainIds.includes(config.chainId)),
    [availableChainIds, configs],
  )

  const { searchQuery, setSearchQuery, resetSearch, isSearching, groups, isSelectedChainVisible } =
    useNetworkSearch(availableChains)

  const addableNetworks = useAddableNetworks(safeAddress, availableChainIds, {
    enabled: showAddableNetworks && open,
  })

  const addableSearchResults = useMemo(
    () => getGroupedFilteredChains(addableNetworks.availableNetworks, searchQuery),
    [addableNetworks.availableNetworks, searchQuery],
  )

  const renderMenuItem = useCallback(
    (chain: Chain, isSelected: boolean) => {
      const onSwitchNetwork = () => {
        trackEvent({ ...OVERVIEW_EVENTS.SWITCH_NETWORK, label: chain.chainId })
      }

      return (
        <MenuItem
          data-testid="network-selector-item"
          key={chain.chainId}
          value={chain.chainId}
          sx={{
            ...(!isSelected && { overflow: 'hidden' }),
            '&:hover': { backgroundColor: isSelected ? 'transparent' : 'inherit' },
          }}
          disableRipple={isSelected}
          onClick={onSwitchNetwork}
        >
          <Link href={getNetworkLink(router, safeAddress, chain)} onClick={onChainSelect} className={css.item}>
            <ChainIndicator
              responsive={isSelected}
              chainId={chain.chainId}
              inline
              onlyLogo={compactButton && isSelected}
              className={css.chainIndicator}
            />
            {!isSelected && <NewNetworkChip chain={chain} />}
          </Link>
        </MenuItem>
      )
    },
    [onChainSelect, router, safeAddress, compactButton],
  )

  const handleClose = () => {
    resetSearch()
    setOpen(false)
  }

  const handleOpen = () => {
    setOpen(true)
    offerSafeCreation && trackEvent({ ...OVERVIEW_EVENTS.EXPAND_MULTI_SAFE, label: OVERVIEW_LABELS.top_bar })
  }

  const showSearchSectionHeaders = isSearching && showAddableNetworks
  const hasAnySearchResults = groups.hasResults || (showAddableNetworks && addableSearchResults.hasResults)

  return configs.length ? (
    <Select
      open={open}
      onClose={handleClose}
      onOpen={handleOpen}
      value={chainId}
      size="small"
      className={css.select}
      variant="standard"
      IconComponent={ExpandMoreIcon}
      renderValue={(value) => {
        const chain = configs.find((config) => config.chainId === value)
        return chain ? renderMenuItem(chain, true) : null
      }}
      MenuProps={{
        transitionDuration: 0,
        autoFocus: false,
        marginThreshold: 16,
        anchorOrigin: {
          vertical: 'bottom',
          horizontal: 'right',
        },
        transformOrigin: {
          vertical: 'top',
          horizontal: 'right',
        },
        sx: {
          '& .MuiPaper-root': {
            overflow: 'auto',
            width: 260,
            maxWidth: 'calc(100vw - 32px) !important',
            minWidth: '260px !important',
          },
          ...(isDarkMode
            ? {
                '& .Mui-selected, & .Mui-selected:hover': {
                  backgroundColor: `${theme.palette.secondary.background} !important`,
                },
              }
            : {}),
        },
      }}
      sx={{
        backgroundColor: 'transparent',
        '& .MuiInput-root::before': {
          borderBottom: 'none',
        },
        '& .MuiInput-root::after': {
          borderBottom: 'none',
        },
        '& .MuiSelect-select': {
          py: 0,
        },
        ...(compactButton && {
          '& .MuiSelect-icon': {
            fontSize: 16,
          },
        }),
      }}
    >
      <NetworkMenuSearch value={searchQuery} onChange={setSearchQuery} />
      {isSearching && !isSelectedChainVisible(chainId) && <MenuItem value={chainId} sx={{ display: 'none' }} />}
      {isSearching && !hasAnySearchResults && <NoNetworksFound />}
      {showSearchSectionHeaders && groups.hasResults && <NetworkSectionHeader label="Deployed on" />}
      {renderNetworkGroups(groups, (chain) => renderMenuItem(chain, false))}

      {showAddableNetworks && (
        <AddableNetworksSection
          isSearching={isSearching}
          groupedNetworks={addableSearchResults}
          safeAddress={safeAddress}
          closeNetworkSelect={handleClose}
          safeCreationResult={addableNetworks.safeCreationResult}
          isUnsupportedSafeCreationVersion={addableNetworks.isUnsupportedSafeCreationVersion}
          noAvailableNetworks={addableNetworks.noAvailableNetworks}
        />
      )}
    </Select>
  ) : (
    <Skeleton width={94} height={31} sx={{ mx: 2 }} />
  )
}

export default NetworkSelector
