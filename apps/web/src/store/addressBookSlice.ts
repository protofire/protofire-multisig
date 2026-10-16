import { createSelector, createSlice, type PayloadAction } from '@reduxjs/toolkit'
import { validateAddress } from '@safe-global/utils/utils/validation'
import { checksumAddress } from '@safe-global/utils/utils/addresses'
import pickBy from 'lodash/pickBy'
import type { RootState } from '.'

export type AddressBook = { [address: string]: string }

export type AddressBookState = { [chainId: string]: AddressBook }

const initialState: AddressBookState = {}

export const addressBookSlice = createSlice({
  name: 'addressBook',
  initialState,
  reducers: {
    migrate: (state, action: PayloadAction<AddressBookState>): AddressBookState => {
      // Don't migrate if there's data already
      if (Object.keys(state).length > 0) return state
      // Otherwise, migrate
      return action.payload
    },

    setAddressBook: (_, action: PayloadAction<AddressBookState>): AddressBookState => {
      return action.payload
    },

    upsertAddressBookEntries: (state, action: PayloadAction<{ chainIds: string[]; address: string; name: string }>) => {
      const { chainIds, address, name } = action.payload
      if (name.trim() === '') {
        return
      }
      // Normalize to EIP-55 checksum before writing. The read selector
      // (selectAddressBookByChain) filters keys through validateAddress, which
      // requires checksummed casing. On Tron, addresses arrive here as
      // lowercase hex (from fromTronBase58Sync) and would be silently dropped
      // on read — surfacing as "Save did nothing" (BUG-04 / GSD-12881).
      const normalizedAddress = checksumAddress(address)
      chainIds.forEach((chainId) => {
        if (!state[chainId]) state[chainId] = {}
        state[chainId][normalizedAddress] = name
      })
    },

    removeAddressBookEntry: (state, action: PayloadAction<{ chainId: string; address: string }>) => {
      const { chainId, address } = action.payload
      if (!state[chainId]) return state
      // Match the checksumming done by upsertAddressBookEntries so removal
      // works regardless of the caller's casing.
      const normalizedAddress = checksumAddress(address)
      delete state[chainId][normalizedAddress]
      if (Object.keys(state[chainId]).length > 0) return state
      delete state[chainId]
    },
  },
})

export const { setAddressBook, upsertAddressBookEntries, removeAddressBookEntry } = addressBookSlice.actions

export const selectAllAddressBooks = (state: RootState): AddressBookState => {
  return state[addressBookSlice.name]
}

export const selectAddressBookByChain = createSelector(
  [selectAllAddressBooks, (_, chainId: string) => chainId],
  (allAddressBooks, chainId): AddressBook => {
    const chainAddresses = allAddressBooks[chainId]
    const validAddresses = pickBy(chainAddresses, (_, key) => validateAddress(key) === undefined)
    return chainId ? validAddresses || {} : {}
  },
)
