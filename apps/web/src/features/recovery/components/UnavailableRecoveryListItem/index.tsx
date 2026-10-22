import { Accordion, AccordionDetails, AccordionSummary, Alert, Box, Typography } from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { useContext, useState } from 'react'
import type { ComponentProps, ReactElement } from 'react'

import DateTime from '@/components/common/DateTime'
import ErrorMessage from '@/components/tx/ErrorMessage'
import { generateDataRowValue, TxDataRow } from '@/components/transactions/TxDetails/Summary/TxDataRow'
import { dateString } from '@safe-global/utils/utils/formatters'
import RecoveryType from '../RecoveryType'
import RecoveryStatus from '../RecoveryStatus'
import CancelRecoveryButton from '../CancelRecoveryButton'
import { RecoveryListItemContext, RecoveryListItemProvider } from '../RecoveryListItem/RecoveryListItemContext'
import type { UnavailableRecoveryQueueItem } from '@/features/recovery/services/recovery-state'

import summaryCss from '@/components/transactions/TxSummary/styles.module.css'
import txDetailsCss from '@/components/transactions/TxDetails/styles.module.css'

export const UNAVAILABLE_RECOVERY_MESSAGE =
  "The details of this recovery proposal couldn't be loaded from the network. It can still be executed once the review window has passed. If you don't recognise it, cancel it."

function ProvidedUnavailableRecoveryListItem({ item }: { item: UnavailableRecoveryQueueItem }): ReactElement {
  const { submitError, setSubmitError } = useContext(RecoveryListItemContext)
  const [expanded, setExpanded] = useState(false)

  const isExpanded = !!submitError || expanded

  const onChange = () => {
    if (isExpanded) {
      setExpanded(false)
      setSubmitError(undefined)
    } else {
      setExpanded(true)
    }
  }

  return (
    <Accordion
      disableGutters
      elevation={0}
      expanded={isExpanded}
      onChange={onChange}
      data-testid="unavailable-recovery-item"
    >
      <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ justifyContent: 'flex-start', overflowX: 'auto' }}>
        <Box className={summaryCss.gridContainer}>
          <Box gridArea="type">
            <RecoveryType isMalicious={false} />
          </Box>

          <Box gridArea="info">
            <Typography variant="body2" color="text.secondary">
              Details unavailable
            </Typography>
          </Box>

          <Box gridArea="date" className={summaryCss.date}>
            <DateTime value={Number(item.timestamp)} />
          </Box>

          <Box gridArea="status">
            <RecoveryStatus recovery={item} />
          </Box>
        </Box>
      </AccordionSummary>

      <AccordionDetails sx={{ p: 0 }}>
        <div className={txDetailsCss.container}>
          <div className={txDetailsCss.details}>
            <div className={txDetailsCss.txData}>
              <Alert severity="warning">{UNAVAILABLE_RECOVERY_MESSAGE}</Alert>

              {submitError && (
                <ErrorMessage error={submitError}>Error submitting the transaction. Please try again.</ErrorMessage>
              )}
            </div>

            <div className={txDetailsCss.txSummary}>
              <TxDataRow title="Created:">{dateString(Number(item.timestamp))}</TxDataRow>
              <TxDataRow title="Executable:">{dateString(Number(item.validFrom))}</TxDataRow>
              {item.expiresAt !== null && <TxDataRow title="Expires:">{dateString(Number(item.expiresAt))}</TxDataRow>}
              <TxDataRow title="Module:">{generateDataRowValue(item.address, 'address', true)}</TxDataRow>
              <TxDataRow title="Queue nonce:">{item.args.queueNonce.toString()}</TxDataRow>
              <TxDataRow title="Proposal hash:">{generateDataRowValue(item.args.txHash, 'hash')}</TxDataRow>
            </div>
          </div>

          <Box className={txDetailsCss.txSigners} display="flex" alignItems="center" justifyContent="center">
            <CancelRecoveryButton recovery={item} />
          </Box>
        </div>
      </AccordionDetails>
    </Accordion>
  )
}

export default function UnavailableRecoveryListItem(
  props: ComponentProps<typeof ProvidedUnavailableRecoveryListItem>,
): ReactElement {
  return (
    <RecoveryListItemProvider>
      <ProvidedUnavailableRecoveryListItem {...props} />
    </RecoveryListItemProvider>
  )
}
