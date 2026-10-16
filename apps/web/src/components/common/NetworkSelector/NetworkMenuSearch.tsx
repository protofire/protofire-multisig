import SearchIcon from '@mui/icons-material/Search'
import { InputAdornment, ListSubheader, TextField } from '@mui/material'
import type { ReactElement } from 'react'

type NetworkMenuSearchProps = {
  value: string
  onChange: (value: string) => void
}

const NetworkMenuSearch = ({ value, onChange }: NetworkMenuSearchProps): ReactElement => {
  return (
    <ListSubheader
      sx={{
        position: 'sticky',
        top: 0,
        zIndex: 1,
        bgcolor: 'background.paper',
        lineHeight: 'normal',
        p: 1,
      }}
    >
      <TextField
        size="small"
        placeholder="Search networks"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== 'Escape' && event.key !== 'Tab') {
            event.stopPropagation()
          }
        }}
        onClick={(event) => event.stopPropagation()}
        autoFocus
        fullWidth
        inputProps={{ 'data-testid': 'network-search-input' }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon fontSize="small" />
            </InputAdornment>
          ),
        }}
      />
    </ListSubheader>
  )
}

export default NetworkMenuSearch
