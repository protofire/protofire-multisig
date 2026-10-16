import ExpandMoreIcon from '@mui/icons-material/KeyboardArrowDownRounded'
import { Box, ButtonBase, CircularProgress, Stack } from '@mui/material'
import type { ReactElement } from 'react'
import css from './styles.module.css'

type NetworkSectionHeaderProps = {
  label: string
  onToggle?: () => void
  isExpanded?: boolean
  isLoading?: boolean
  testId?: string
}

const NetworkSectionHeader = ({
  label,
  onToggle,
  isExpanded,
  isLoading = false,
  testId,
}: NetworkSectionHeaderProps): ReactElement => {
  const content = (
    <Stack direction="row" spacing={1} sx={{ alignItems: 'center', justifyContent: 'center' }}>
      <div data-testid={testId}>{label}</div>
      {isLoading && <CircularProgress size={14} />}
      {onToggle && <ExpandMoreIcon fontSize="small" sx={{ transform: isExpanded ? 'rotate(180deg)' : undefined }} />}
    </Stack>
  )

  if (onToggle) {
    return (
      <ButtonBase className={css.listSubHeader} onClick={onToggle} tabIndex={-1}>
        {content}
      </ButtonBase>
    )
  }

  return <Box className={css.listSubHeader}>{content}</Box>
}

export default NetworkSectionHeader
