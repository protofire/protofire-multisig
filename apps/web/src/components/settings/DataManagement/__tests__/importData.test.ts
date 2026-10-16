import { configureStore } from '@reduxjs/toolkit'
import { addressBookSlice } from '@/store/addressBookSlice'
import { addedSafesSlice } from '@/store/addedSafesSlice'
import { settingsSlice } from '@/store/settingsSlice'
import { safeAppsSlice } from '@/store/safeAppsSlice'
import { undeployedSafesSlice } from '@/features/counterfactual/store'
import { visitedSafesSlice } from '@/store/visitedSafesSlice'
import { dispatchImportedData } from '../importData'

const EXISTING_ADDRESS = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045'
const IMPORTED_ADDRESS = '0x1234567890123456789012345678901234567890'

const createTestStore = () =>
  configureStore({
    reducer: {
      [addressBookSlice.name]: addressBookSlice.reducer,
      [addedSafesSlice.name]: addedSafesSlice.reducer,
      [settingsSlice.name]: settingsSlice.reducer,
      [safeAppsSlice.name]: safeAppsSlice.reducer,
      [undeployedSafesSlice.name]: undeployedSafesSlice.reducer,
      [visitedSafesSlice.name]: visitedSafesSlice.reducer,
    },
  })

describe('dispatchImportedData (merge)', () => {
  it('upserts the address book, keeping existing entries the import does not mention', () => {
    const store = createTestStore()
    store.dispatch(
      addressBookSlice.actions.upsertAddressBookEntries({
        chainIds: ['1'],
        address: EXISTING_ADDRESS,
        name: 'Existing',
      }),
    )

    dispatchImportedData(store.dispatch, { addressBook: { '1': { [IMPORTED_ADDRESS]: 'Imported' } } }, 'merge')

    expect(store.getState().addressBook).toEqual({
      '1': { [EXISTING_ADDRESS]: 'Existing', [IMPORTED_ADDRESS]: 'Imported' },
    })
  })

  it('upserts added Safes, preserving the ethBalance of an overlapping entry and other chains untouched', () => {
    const store = createTestStore()
    store.dispatch(
      addedSafesSlice.actions.upsertAddedSafe({
        chainId: '1',
        address: EXISTING_ADDRESS,
        safe: { owners: [{ value: '0xOldOwner' }], threshold: 1, ethBalance: '42' },
      }),
    )
    store.dispatch(
      addedSafesSlice.actions.upsertAddedSafe({
        chainId: '4',
        address: IMPORTED_ADDRESS,
        safe: { owners: [{ value: '0xUntouched' }], threshold: 1 },
      }),
    )

    dispatchImportedData(
      store.dispatch,
      {
        addedSafes: { '1': { [EXISTING_ADDRESS]: { owners: [{ value: '0xNewOwner' }], threshold: 2 } } },
      },
      'merge',
    )

    expect(store.getState().addedSafes).toEqual({
      '1': { [EXISTING_ADDRESS]: { owners: [{ value: '0xNewOwner' }], threshold: 2, ethBalance: '42' } },
      '4': { [IMPORTED_ADDRESS]: { owners: [{ value: '0xUntouched' }], threshold: 1 } },
    })
  })

  it('upserts visited Safes, keeping entries the import does not mention and updating overlapping ones', () => {
    const store = createTestStore()
    store.dispatch(
      visitedSafesSlice.actions.upsertVisitedSafe({ chainId: '1', address: EXISTING_ADDRESS, lastVisited: 100 }),
    )
    store.dispatch(
      visitedSafesSlice.actions.upsertVisitedSafe({ chainId: '4', address: IMPORTED_ADDRESS, lastVisited: 200 }),
    )

    dispatchImportedData(
      store.dispatch,
      {
        visitedSafes: { '1': { [EXISTING_ADDRESS]: { lastVisited: 999 } } },
      },
      'merge',
    )

    expect(store.getState().visitedSafes).toEqual({
      '1': { [EXISTING_ADDRESS]: { lastVisited: 999 } },
      '4': { [IMPORTED_ADDRESS]: { lastVisited: 200 } },
    })
  })

  it('upserts undeployed Safes, keeping entries the import does not mention and replacing overlapping ones', () => {
    const store = createTestStore()
    store.dispatch(
      undeployedSafesSlice.actions.upsertUndeployedSafe({
        chainId: '4',
        address: IMPORTED_ADDRESS,
        safe: { props: { untouched: true }, status: { status: 'UNTOUCHED', type: 'UNTOUCHED' } } as never,
      }),
    )

    dispatchImportedData(
      store.dispatch,
      {
        undeployedSafes: {
          '1': {
            [EXISTING_ADDRESS]: {
              props: { imported: true },
              status: { status: 'IMPORTED', type: 'IMPORTED' },
            } as never,
          },
        },
      },
      'merge',
    )

    expect(store.getState().undeployedSafes).toEqual({
      '1': { [EXISTING_ADDRESS]: { props: { imported: true }, status: { status: 'IMPORTED', type: 'IMPORTED' } } },
      '4': { [IMPORTED_ADDRESS]: { props: { untouched: true }, status: { status: 'UNTOUCHED', type: 'UNTOUCHED' } } },
    })
  })

  it('still fully overwrites settings, resetting values the import does not mention to defaults', () => {
    const store = createTestStore()
    store.dispatch(settingsSlice.actions.setCurrency('eur'))
    store.dispatch(settingsSlice.actions.setHideDust(true))

    dispatchImportedData(store.dispatch, { settings: { currency: 'gbp' } as never }, 'merge')

    expect(store.getState().settings.currency).toBe('gbp')
    // hideDust wasn't in the imported payload - still reset to the default, not kept.
    expect(store.getState().settings.hideDust).toBe(false)
  })

  it('still fully overwrites safeApps, dropping chains the import does not mention', () => {
    const store = createTestStore()
    store.dispatch(safeAppsSlice.actions.setPinned({ chainId: '4', pinned: [1, 2] }))

    dispatchImportedData(store.dispatch, { safeApps: { '1': { pinned: [3], opened: [] } } }, 'merge')

    expect(store.getState().safeApps).toEqual({ '1': { pinned: [3], opened: [] } })
  })
})

describe('dispatchImportedData (overwrite)', () => {
  it('replaces the address book wholesale, dropping entries the import does not mention', () => {
    const store = createTestStore()
    store.dispatch(
      addressBookSlice.actions.upsertAddressBookEntries({
        chainIds: ['1'],
        address: EXISTING_ADDRESS,
        name: 'Existing',
      }),
    )

    dispatchImportedData(store.dispatch, { addressBook: { '1': { [IMPORTED_ADDRESS]: 'Imported' } } }, 'overwrite')

    expect(store.getState().addressBook).toEqual({ '1': { [IMPORTED_ADDRESS]: 'Imported' } })
  })

  it('replaces added Safes wholesale, dropping other chains', () => {
    const store = createTestStore()
    store.dispatch(
      addedSafesSlice.actions.upsertAddedSafe({
        chainId: '4',
        address: EXISTING_ADDRESS,
        safe: { owners: [{ value: '0xOld' }], threshold: 1 },
      }),
    )

    dispatchImportedData(
      store.dispatch,
      { addedSafes: { '1': { [IMPORTED_ADDRESS]: { owners: [{ value: '0xNew' }], threshold: 2 } } } },
      'overwrite',
    )

    expect(store.getState().addedSafes).toEqual({
      '1': { [IMPORTED_ADDRESS]: { owners: [{ value: '0xNew' }], threshold: 2 } },
    })
  })

  it('replaces visited Safes wholesale', () => {
    const store = createTestStore()
    store.dispatch(
      visitedSafesSlice.actions.upsertVisitedSafe({ chainId: '4', address: EXISTING_ADDRESS, lastVisited: 100 }),
    )

    dispatchImportedData(
      store.dispatch,
      { visitedSafes: { '1': { [IMPORTED_ADDRESS]: { lastVisited: 999 } } } },
      'overwrite',
    )

    expect(store.getState().visitedSafes).toEqual({ '1': { [IMPORTED_ADDRESS]: { lastVisited: 999 } } })
  })
})
