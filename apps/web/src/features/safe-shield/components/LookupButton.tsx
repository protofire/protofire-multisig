import type { ReactElement } from 'react'
import { Box, Typography } from '@mui/material'

export const LookupButton = ({
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
