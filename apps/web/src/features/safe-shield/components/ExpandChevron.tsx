import type { ReactElement } from 'react'
import { IconButton } from '@mui/material'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'

export const ExpandChevron = ({ isExpanded }: { isExpanded: boolean }): ReactElement => (
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
)
