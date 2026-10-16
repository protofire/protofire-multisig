import { Box, Typography } from '@mui/material'
import type { ReactElement } from 'react'

const NoNetworksFound = (): ReactElement => (
  <Box sx={{ px: 2, py: 1 }}>
    <Typography variant="body2" color="text.secondary">
      No networks found
    </Typography>
  </Box>
)

export default NoNetworksFound
