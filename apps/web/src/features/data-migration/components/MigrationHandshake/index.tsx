import { useEffect, useState } from 'react'
import type { ReactElement } from 'react'
import { Box, CircularProgress, Typography } from '@mui/material'
import { decodeMigrationFragment } from '../../services/decodeMigrationFragment'
import { parseMigrationPayload } from '../../services/parseMigrationPayload'
import type { ParsedImportData } from '@/components/settings/DataManagement/useGlobalImportFileParser'
import MigrationConfirmDialog from '../MigrationConfirmDialog'
import MigrationFallback from '../MigrationFallback'

type HandshakeStatus = 'decoding' | 'error' | 'confirm'

const MigrationHandshake = (): ReactElement => {
  const [status, setStatus] = useState<HandshakeStatus>('decoding')
  const [parsedData, setParsedData] = useState<ParsedImportData>()

  useEffect(() => {
    let cancelled = false

    const hash = window.location.hash
    // The payload has been read into memory at this point - strip it from the URL so it
    // doesn't linger in the address bar, browser history, or get re-processed on refresh.
    window.history.replaceState(null, '', window.location.pathname + window.location.search)

    decodeMigrationFragment(hash)
      .then((payload) => {
        if (cancelled) return
        setParsedData(parseMigrationPayload(payload))
        setStatus('confirm')
      })
      .catch(() => {
        if (cancelled) return
        setStatus('error')
      })

    return () => {
      cancelled = true
    }
  }, [])

  if (status === 'confirm' && parsedData) {
    return <MigrationConfirmDialog data={parsedData} />
  }

  if (status === 'error') {
    return <MigrationFallback />
  }

  return (
    <Box display="flex" flexDirection="column" alignItems="center" gap={2} mt={8} data-testid="migration-pending">
      <CircularProgress />
      <Typography>Reading your data…</Typography>
    </Box>
  )
}

export default MigrationHandshake
