import { Divider, Typography } from '@mui/material'
import type { ReactElement } from 'react'

const NetworkGroupDivider = ({ label }: { label: string }): ReactElement => {
  return (
    <Divider sx={{ m: '0px !important', '& .MuiDivider-wrapper': { p: '0px 16px' } }}>
      <Typography
        variant="overline"
        sx={{
          color: 'border.main',
        }}
      >
        {label}
      </Typography>
    </Divider>
  )
}

export default NetworkGroupDivider
