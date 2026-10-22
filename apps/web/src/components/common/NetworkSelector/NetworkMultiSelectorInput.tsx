import { useCallback, useMemo, type ReactElement, type ReactNode } from 'react'
import { Checkbox, Autocomplete, TextField, Chip, Box, Typography } from '@mui/material'
import type { Chain } from '@safe-global/store/gateway/AUTO_GENERATED/chains'
import partition from 'lodash/partition'
import ChainIndicator from '../ChainIndicator'
import css from './styles.module.css'
import { scrollableChainListCss } from '@/components/common/ScrollableChainList'
import { useFormContext } from 'react-hook-form'
import useChains from '@/hooks/useChains'
import NetworkGroupDivider from './NetworkGroupDivider'
import NewNetworkChip from './NewNetworkChip'
import { NETWORK_GROUP, getNetworkGroup } from './utils'

type NetworkMultiSelectorInputProps = {
  value: Chain[]
  name: string
  onNetworkChange?: (networks: Chain[]) => void
  isOptionDisabled?: (network: Chain) => boolean
  getOptionNote?: (network: Chain) => string | undefined
  error?: boolean
  helperText?: string
  placeholder?: string
  showSelectAll?: boolean
}

const SELECT_ALL_OPTION = { chainId: 'select-all', chainName: 'Select All' } as Chain
// MUI groupBy only groups contiguous options. SELECT_ALL_OPTION must stay first in the
// pre-sorted options array ([...prodNets, ...testNets]) so its empty-string group stays separate.
const SELECT_ALL_GROUP = ''

const NetworkMultiSelectorInput = ({
  value,
  name,
  onNetworkChange,
  isOptionDisabled,
  getOptionNote,
  error,
  helperText,
  placeholder,
  showSelectAll = false,
}: NetworkMultiSelectorInputProps): ReactElement => {
  const { configs } = useChains()
  const { setValue } = useFormContext()

  const getOptionDisabled = isOptionDisabled || (() => false)

  const handleChange = useCallback(
    (newNetworks: Chain[]) => {
      const filteredData = showSelectAll
        ? newNetworks.filter((item) => item.chainId !== SELECT_ALL_OPTION.chainId)
        : newNetworks

      setValue(name, filteredData, { shouldValidate: true })
      if (onNetworkChange) {
        onNetworkChange(filteredData)
      }
    },
    [name, setValue, onNetworkChange, showSelectAll],
  )

  const handleDelete = useCallback(
    (deletedChainId: string) => {
      const updatedValues = value.filter((chain) => chain.chainId !== deletedChainId)
      handleChange(updatedValues)
    },
    [handleChange, value],
  )

  const isAllSelected = value.length === configs.length

  const toggleSelectAll = useCallback(() => {
    if (isAllSelected) {
      handleChange([])
    } else {
      handleChange(configs)
    }
  }, [isAllSelected, handleChange, configs])

  const hasTestnetsInList = useMemo(() => configs.some((config) => config.isTestnet), [configs])

  const options = useMemo(() => {
    const [testNets, prodNets] = partition(configs, (config) => config.isTestnet)
    const sortedConfigs = [...prodNets, ...testNets]
    return showSelectAll ? [SELECT_ALL_OPTION, ...sortedConfigs] : sortedConfigs
  }, [configs, showSelectAll])

  const renderTags = useCallback(
    (selectedOptions: (Chain | typeof SELECT_ALL_OPTION)[]) => {
      if (showSelectAll && isAllSelected) {
        return (
          <Typography variant="body2">
            All networks{' '}
            <Box component="span" sx={{ color: 'text.secondary' }}>
              (Default)
            </Box>
          </Typography>
        )
      }

      return (
        <Box className={`${css.selectedChips} ${scrollableChainListCss.scrollbar}`}>
          {selectedOptions.map((chain) => (
            <Chip
              variant="outlined"
              key={chain.chainId}
              avatar={<ChainIndicator chainId={chain.chainId} onlyLogo inline />}
              label={chain.chainName}
              onDelete={() => handleDelete(chain.chainId)}
              className={css.multiChainChip}
            />
          ))}
        </Box>
      )
    },
    [showSelectAll, isAllSelected, handleDelete],
  )

  const renderOption = useCallback(
    (
      props: React.HTMLAttributes<HTMLLIElement> & { key: string },
      chain: Chain | typeof SELECT_ALL_OPTION,
      { selected }: { selected: boolean },
    ) => {
      const { key, ...rest } = props

      if (showSelectAll && chain.chainId === SELECT_ALL_OPTION.chainId) {
        return (
          <Box component="li" key={key} {...rest} onClick={toggleSelectAll}>
            <Checkbox data-testid="select-all-checkbox" size="small" checked={isAllSelected} />
            <span>Select All</span>
          </Box>
        )
      }

      const note = getOptionNote?.(chain)

      return (
        <Box component="li" key={key} {...rest}>
          <Checkbox data-testid="network-checkbox" size="small" checked={selected} />
          <ChainIndicator chainId={chain.chainId} inline />
          <NewNetworkChip chain={chain} />
          {note && (
            <Typography variant="caption" ml="auto" pl={1}>
              {note}
            </Typography>
          )}
        </Box>
      )
    },
    [showSelectAll, isAllSelected, toggleSelectAll, getOptionNote],
  )

  const renderGroup = useCallback(
    (params: { group: string; key: string; children?: ReactNode }) => {
      const showDivider =
        params.group === NETWORK_GROUP.testnets || (params.group === NETWORK_GROUP.mainnets && hasTestnetsInList)

      return (
        <li key={params.key}>
          {showDivider && <NetworkGroupDivider label={params.group} />}
          <Box component="ul" sx={{ p: 0, m: 0 }}>
            {params.children}
          </Box>
        </li>
      )
    },
    [hasTestnetsInList],
  )

  return (
    <Autocomplete
      multiple
      value={value || []}
      disableCloseOnSelect
      options={options}
      groupBy={(option) =>
        showSelectAll && option.chainId === SELECT_ALL_OPTION.chainId ? SELECT_ALL_GROUP : getNetworkGroup(option)
      }
      renderTags={renderTags}
      renderOption={renderOption}
      renderGroup={renderGroup}
      getOptionLabel={(option) => option.chainName}
      getOptionDisabled={(option) =>
        showSelectAll && option.chainId === SELECT_ALL_OPTION.chainId ? false : getOptionDisabled(option)
      }
      renderInput={(params) => (
        <TextField {...params} placeholder={placeholder} error={error} helperText={helperText} />
      )}
      filterOptions={(options, { inputValue }) => {
        if (!inputValue) return options
        return options.filter(
          (option) =>
            (showSelectAll && option.chainId === SELECT_ALL_OPTION.chainId) ||
            option.chainName.toLowerCase().includes(inputValue.toLowerCase()),
        )
      }}
      isOptionEqualToValue={(option, value) => option.chainId === value.chainId}
      onChange={(_, data) => handleChange(data)}
    />
  )
}

export default NetworkMultiSelectorInput
