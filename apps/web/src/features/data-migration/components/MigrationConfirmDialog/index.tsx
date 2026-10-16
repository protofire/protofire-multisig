import type { ReactElement } from 'react'
import { useRouter } from 'next/router'
import { Box, DialogContent, DialogActions, Button, Alert, AlertTitle, SvgIcon } from '@mui/material'
import ModalDialog from '@/components/common/ModalDialog'
import { useAppDispatch } from '@/store'
import { showNotification } from '@/store/notificationsSlice'
import { dispatchImportedData, hasImportableData } from '@/components/settings/DataManagement/importData'
import { FileListCard } from '@/components/settings/DataManagement/FileListCard'
import type { ParsedImportData } from '@/components/settings/DataManagement/useGlobalImportFileParser'
import type { AddedSafesState } from '@/store/addedSafesSlice'
import type { VisitedSafesState } from '@/store/visitedSafesSlice'
import useChains from '@/hooks/useChains'
import FileIcon from '@/public/images/settings/data/file.svg'
import { AppRoutes } from '@/config/routes'

/**
 * Picks the imported Safe to land the user on after a successful migration, ranked by
 * the migrated `visitedSafes.lastVisited` timestamp (same "most recently used" signal
 * `lastVisitedComparator` in hooks/safes/comparators.ts uses elsewhere) rather than
 * whatever order the added-Safes object happens to iterate in. Safes with no visit
 * record default to 0, so if none were ever visited this falls back to the first one
 * encountered - deterministic, just not meaningfully "most relevant".
 */
const getMostRelevantAddedSafe = (
  addedSafes?: AddedSafesState,
  visitedSafes?: VisitedSafesState,
): { chainId: string; address: string } | undefined => {
  let best: { chainId: string; address: string; lastVisited: number } | undefined

  for (const [chainId, safes] of Object.entries(addedSafes ?? {})) {
    for (const address of Object.keys(safes)) {
      const lastVisited = visitedSafes?.[chainId]?.[address]?.lastVisited ?? 0
      if (!best || lastVisited > best.lastVisited) {
        best = { chainId, address, lastVisited }
      }
    }
  }

  return best
}

const MigrationConfirmDialog = ({ data }: { data: ParsedImportData }): ReactElement => {
  const dispatch = useAppDispatch()
  const router = useRouter()
  const chains = useChains()

  const { addedSafes, addressBook, settings, safeApps, undeployedSafes, visitedSafes, error } = data
  const isDisabled =
    !hasImportableData({ addedSafes, addressBook, settings, safeApps, undeployedSafes, visitedSafes }) || !!error

  const handleCancel = () => {
    router.push(AppRoutes.welcome.index)
  }

  const handleConfirm = () => {
    // Nothing reaches Redux/localStorage before this explicit confirmation.
    dispatchImportedData(
      dispatch,
      { addressBook, addedSafes, settings, safeApps, undeployedSafes, visitedSafes },
      'merge',
    )

    dispatch(
      showNotification({
        variant: 'success',
        groupKey: 'data-migration-success',
        message: 'Successfully moved your data to the new Safe UI',
      }),
    )

    const relevantSafe = getMostRelevantAddedSafe(addedSafes, visitedSafes)
    const chain = relevantSafe && chains.configs.find(({ chainId }) => chainId === relevantSafe.chainId)

    if (relevantSafe && chain) {
      router.push({ pathname: AppRoutes.home, query: { safe: `${chain.shortName}:${relevantSafe.address}` } })
    } else {
      handleCancel()
    }
  }

  return (
    <ModalDialog open onClose={handleCancel} dialogTitle="Sync your data" hideChainIndicator>
      <DialogContent>
        <FileListCard
          avatar={
            <Box sx={{ borderRadius: ({ shape }) => `${shape.borderRadius}px` }}>
              <SvgIcon component={FileIcon} inheritViewBox fontSize="small" sx={{ fill: 'none', display: 'block' }} />
            </Box>
          }
          title={<b>Data to sync</b>}
          addedSafes={addedSafes}
          addressBook={addressBook}
          settings={settings}
          safeApps={safeApps}
          visitedSafes={visitedSafes}
          undeployedSafes={undeployedSafes}
          error={error}
          showPreview
        />
        {!isDisabled && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            <AlertTitle sx={{ fontWeight: 700 }}>Merge with your current data?</AlertTitle>
            Added Safe Accounts and address book entries will be merged with what you already have in this browser -
            matching entries are updated, the rest is left as is. Settings will be overwritten.
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button data-testid="migration-dialog-cancel-btn" onClick={handleCancel}>
          Cancel
        </Button>
        <Button
          data-testid="migration-dialog-confirm-btn"
          onClick={handleConfirm}
          variant="contained"
          disableElevation
          disabled={isDisabled}
        >
          Move my data
        </Button>
      </DialogActions>
    </ModalDialog>
  )
}

export default MigrationConfirmDialog
