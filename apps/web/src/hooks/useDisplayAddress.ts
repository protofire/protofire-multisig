import useTronAddress from '@/hooks/useTronAddress'
import useRootstockAddress, { useRootstockCopyAddressFormatter } from '@/hooks/useRootstockAddress'

type DisplayAddressResult = {
  displayAddress: string
  copyAddress: string
  isTron: boolean
}

/**
 * Chain-specific view of an address (Tron base58, Rootstock EIP-1191). The raw address stays the
 * source of truth for forms, stores, URLs and API calls
 */
const useDisplayAddress = (
  address: string,
  chainIdOverride?: string,
  { keepEvm = false }: { keepEvm?: boolean } = {},
): DisplayAddressResult => {
  const tron = useTronAddress(address, chainIdOverride)
  const rskAddress = useRootstockAddress(address, chainIdOverride)
  const formatCopyAddress = useRootstockCopyAddressFormatter(chainIdOverride)

  if (tron.isTron) {
    return { displayAddress: tron.displayAddress, copyAddress: tron.copyAddress, isTron: true }
  }

  return keepEvm
    ? { displayAddress: address, copyAddress: address, isTron: false }
    : { displayAddress: rskAddress, copyAddress: formatCopyAddress(address), isTron: false }
}

export default useDisplayAddress
