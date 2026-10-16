import { undeployedSafesSlice } from '@/features/counterfactual/store'
import type { AppDispatch } from '@/store'
import { addedSafesSlice } from '@/store/addedSafesSlice'
import { addressBookSlice } from '@/store/addressBookSlice'
import { safeAppsSlice } from '@/store/safeAppsSlice'
import { settingsSlice } from '@/store/settingsSlice'
import { visitedSafesSlice } from '@/store/visitedSafesSlice'
import { trackEvent, SETTINGS_EVENTS, OVERVIEW_EVENTS, OVERVIEW_LABELS } from '@/services/analytics'
import type { ParsedImportData } from '@/components/settings/DataManagement/useGlobalImportFileParser'

export type ImportableData = Pick<
  ParsedImportData,
  'addressBook' | 'addedSafes' | 'settings' | 'safeApps' | 'undeployedSafes' | 'visitedSafes'
>

export const hasImportableData = (data: ImportableData): boolean =>
  Boolean(
    data.addressBook || data.addedSafes || data.settings || data.safeApps || data.undeployedSafes || data.visitedSafes,
  )

/**
 * How imported entries are applied to what is already in the store.
 *
 * - `overwrite`: every imported slice replaces the existing one wholesale - the manual
 *   Settings -> Data import, so a file restores exactly what it holds (upstream behaviour).
 * - `merge`: addressBook, addedSafes, undeployedSafes and visitedSafes are upserted
 *   entry-by-entry, so existing chains/addresses not present in the imported data are left
 *   untouched - the data-migration confirmation, which must not drop Safes the user
 *   already has here. settings and safeApps are replaced wholesale in both modes.
 */
export type ImportMode = 'overwrite' | 'merge'

/**
 * Dispatches the six persisted slices that both the manual Settings -> Data import
 * (ImportDialog) and the data-migration confirmation dialog can produce.
 */
export const dispatchImportedData = (dispatch: AppDispatch, data: ImportableData, mode: ImportMode): void => {
  const { addressBook, addedSafes, settings, safeApps, undeployedSafes, visitedSafes } = data

  if (addressBook) {
    if (mode === 'overwrite') {
      dispatch(addressBookSlice.actions.setAddressBook(addressBook))
    } else {
      Object.entries(addressBook).forEach(([chainId, entries]) => {
        Object.entries(entries).forEach(([address, name]) => {
          dispatch(addressBookSlice.actions.upsertAddressBookEntries({ chainIds: [chainId], address, name }))
        })
      })
    }
    trackEvent({
      ...SETTINGS_EVENTS.DATA.IMPORT_ADDRESS_BOOK,
      label: Object.values(addressBook).reduce((count, chainAb) => count + Object.keys(chainAb).length, 0),
    })
  }

  if (addedSafes) {
    if (mode === 'overwrite') {
      dispatch(addedSafesSlice.actions.setAddedSafes(addedSafes))
    } else {
      Object.entries(addedSafes).forEach(([chainId, safes]) => {
        Object.entries(safes).forEach(([address, safe]) => {
          dispatch(addedSafesSlice.actions.upsertAddedSafe({ chainId, address, safe }))
        })
      })
    }
    trackEvent({
      ...OVERVIEW_EVENTS.IMPORT_DATA,
      label: OVERVIEW_LABELS.settings,
    })
  }

  if (settings) {
    dispatch(settingsSlice.actions.setSettings(settings))
    trackEvent(SETTINGS_EVENTS.DATA.IMPORT_SETTINGS)
  }

  if (safeApps) {
    dispatch(safeAppsSlice.actions.setSafeApps(safeApps))
    trackEvent(SETTINGS_EVENTS.DATA.IMPORT_SAFE_APPS)
  }

  if (undeployedSafes) {
    if (mode === 'overwrite') {
      dispatch(undeployedSafesSlice.actions.addUndeployedSafes(undeployedSafes))
    } else {
      Object.entries(undeployedSafes).forEach(([chainId, safes]) => {
        Object.entries(safes).forEach(([address, safe]) => {
          dispatch(undeployedSafesSlice.actions.upsertUndeployedSafe({ chainId, address, safe }))
        })
      })
    }
    trackEvent(SETTINGS_EVENTS.DATA.IMPORT_UNDEPLOYED_SAFES)
  }

  if (visitedSafes) {
    if (mode === 'overwrite') {
      dispatch(visitedSafesSlice.actions.setVisitedSafes(visitedSafes))
    } else {
      Object.entries(visitedSafes).forEach(([chainId, safes]) => {
        Object.entries(safes).forEach(([address, { lastVisited }]) => {
          dispatch(visitedSafesSlice.actions.upsertVisitedSafe({ chainId, address, lastVisited }))
        })
      })
    }
    trackEvent(SETTINGS_EVENTS.DATA.IMPORT_VISITED_SAFES)
  }
}
