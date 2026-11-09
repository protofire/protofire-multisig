import { SAFENET_EXPLORER_URL } from '../constants'

export const safenetExplorerTxUrl = (chainId: string, safeTxHash: string): string =>
  `${SAFENET_EXPLORER_URL}/#/safeTx?chainId=${encodeURIComponent(chainId)}&safeTxHash=${encodeURIComponent(safeTxHash)}`
