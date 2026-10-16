import { useEffect, useState, type ReactElement } from 'react'
import { Stack, Typography } from '@mui/material'

export interface NetworkChipProps {
  name: string
  logo?: string
}

const NetworkChip = ({ name, logo }: NetworkChipProps): ReactElement => {
  const [hasLogoError, setHasLogoError] = useState(false)

  useEffect(() => {
    setHasLogoError(false)
  }, [logo])

  return (
    <Stack
      direction="row"
      alignItems="center"
      justifyContent="center"
      gap={1}
      sx={{
        px: 2,
        py: 1,
        borderRadius: 1,
        border: ({ palette }) => `1px solid ${palette.border.light}`,
        backgroundColor: ({ palette }) => palette.background.main,
      }}
    >
      {logo && !hasLogoError && (
        <img
          src={logo}
          alt={`${name} logo`}
          width={28}
          height={28}
          loading="lazy"
          onError={() => setHasLogoError(true)}
          style={{ borderRadius: '50%' }}
        />
      )}
      <Typography variant="body2" fontWeight={700}>
        {name}
      </Typography>
    </Stack>
  )
}

export default NetworkChip
