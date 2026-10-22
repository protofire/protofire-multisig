import { useCallback, useMemo } from 'react'
import { toRskCopyAddress, toRskDisplayAddress } from '@safe-global/utils/utils/rsk-utils'
import useChainId from '@/hooks/useChainId'
import { useChain } from '@/hooks/useChains'
import { useAppSelector } from '@/store'
import { selectRootstockAddressChecksum } from '@/store/settingsSlice'

/**
 * View-level EIP-1191 checksum for Rootstock. Only the displayed text changes,
 * stores, URLs and API calls keep working with the EIP-55 address
 */
export const useRootstockAddressFormatter = (chainIdOverride?: string): ((address: string) => string) => {
  const currentChainId = useChainId()
  const chain = useChain(chainIdOverride ?? currentChainId)
  const checksum = useAppSelector(selectRootstockAddressChecksum)

  return useCallback((address: string) => (checksum ? toRskDisplayAddress(address, chain) : address), [chain, checksum])
}

/**
 * Lower-case address copied on Rootstock for compatibility with all wallets. Independent of the checksum setting
 */
export const useRootstockCopyAddressFormatter = (chainIdOverride?: string): ((address: string) => string) => {
  const currentChainId = useChainId()
  const chain = useChain(chainIdOverride ?? currentChainId)

  return useCallback((address: string) => toRskCopyAddress(address, chain), [chain])
}

const useRootstockAddress = (address: string, chainIdOverride?: string): string => {
  const format = useRootstockAddressFormatter(chainIdOverride)

  return useMemo(() => format(address), [format, address])
}

export default useRootstockAddress
