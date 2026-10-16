import ChainIndicator from '@/components/common/ChainIndicator'
import NetworkMenuSearch from '@/components/common/NetworkSelector/NetworkMenuSearch'
import NoNetworksFound from '@/components/common/NetworkSelector/NoNetworksFound'
import NewNetworkChip from '@/components/common/NetworkSelector/NewNetworkChip'
import { renderNetworkGroups } from '@/components/common/NetworkSelector/renderNetworkGroups'
import { useNetworkSearch } from '@/components/common/NetworkSelector/useNetworkSearch'
import { useDarkMode } from '@/hooks/useDarkMode'
import { useTheme } from '@mui/material/styles'
import { FormControl, InputLabel, MenuItem, Select, Typography } from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import css from './styles.module.css'
import { type ReactElement, useCallback, useState } from 'react'
import { Controller, useFormContext } from 'react-hook-form'
import { type Chain } from '@safe-global/store/gateway/AUTO_GENERATED/chains'

const NetworkInput = ({
  name,
  required = false,
  chainConfigs,
}: {
  name: string
  required?: boolean
  chainConfigs: (Chain & { available: boolean })[]
}): ReactElement => {
  const isDarkMode = useDarkMode()
  const theme = useTheme()
  const { control } = useFormContext() || {}
  const [open, setOpen] = useState(false)
  const { searchQuery, setSearchQuery, resetSearch, isSearching, groups, isSelectedChainVisible } =
    useNetworkSearch(chainConfigs)

  const renderMenuItem = useCallback(
    (chainId: string, isDisabled: boolean) => {
      const chain = chainConfigs.find((chain) => chain.chainId === chainId)
      if (!chain) return null
      return (
        <MenuItem
          disabled={isDisabled}
          key={chainId}
          value={chainId}
          sx={{ '&:hover': { backgroundColor: 'inherit' } }}
        >
          <ChainIndicator chainId={chain.chainId} />
          {isDisabled && (
            <Typography variant="caption" component="span" className={css.disabledChip}>
              Not available
            </Typography>
          )}
          {!isDisabled && <NewNetworkChip chain={chain} />}
        </MenuItem>
      )
    },
    [chainConfigs],
  )

  return (
    <Controller
      name={name}
      rules={{ required }}
      control={control}
      // eslint-disable-next-line
      render={({ field: { ref, ...field } }) => (
        <FormControl fullWidth>
          <InputLabel id="network-input-label">Network</InputLabel>
          <Select
            {...field}
            open={open}
            onOpen={() => setOpen(true)}
            onClose={() => {
              resetSearch()
              setOpen(false)
            }}
            labelId="network-input-label"
            id="network-input"
            fullWidth
            label="Network"
            IconComponent={ExpandMoreIcon}
            renderValue={(value) => renderMenuItem(value, false)}
            MenuProps={{
              autoFocus: false,
              sx: {
                '& .MuiPaper-root': {
                  overflow: 'auto',
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
          >
            <NetworkMenuSearch value={searchQuery} onChange={setSearchQuery} />
            {isSearching && field.value && !isSelectedChainVisible(field.value) && (
              <MenuItem value={field.value} sx={{ display: 'none' }} />
            )}
            {isSearching && !groups.hasResults && <NoNetworksFound />}
            {renderNetworkGroups(groups, (chain) => renderMenuItem(chain.chainId, !chain.available))}
          </Select>
        </FormControl>
      )}
    />
  )
}

export default NetworkInput
