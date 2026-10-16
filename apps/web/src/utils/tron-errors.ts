import { isTronChain } from '@/utils/tron'

const TRON_ERROR_PATTERNS: Array<{
  pattern: RegExp
  message: string
}> = [
  {
    pattern: /bandwidth[_ ]not[_ ]enough|BANDWIDTH_EXCEEDED/i,
    message: 'Insufficient bandwidth. Freeze TRX for bandwidth or wait 24 hours for free bandwidth to regenerate.',
  },
  {
    pattern: /energy[_ ]not[_ ]enough|ENERGY_NOT_ENOUGH/i,
    message: 'Insufficient energy. Freeze TRX for energy to execute smart contract transactions.',
  },
  {
    pattern: /tronLink.*not\s*(found|installed|detected)/i,
    message: 'TronLink wallet not detected. Please install the TronLink browser extension.',
  },
  {
    pattern: /tron_requestAccounts.*reject|user\s+rejected|cancelled/i,
    message: 'Connection rejected. Please approve the connection request in TronLink.',
  },
]

/**
 * Translate a Tron-specific error into a user-friendly message.
 * Returns the original error message if no Tron pattern matches.
 */
export const translateTronError = (error: unknown, chainId?: string): string => {
  if (chainId && !isTronChain(chainId)) {
    return error instanceof Error ? error.message : String(error)
  }

  const message = error instanceof Error ? error.message : String(error)

  for (const { pattern, message: userMessage } of TRON_ERROR_PATTERNS) {
    if (pattern.test(message)) {
      return userMessage
    }
  }

  return message
}

/**
 * Default fee limit for Tron transactions (in sun).
 * Used when eth_estimateGas returns 0x0 (unreliable on Tron).
 */
export const TRON_DEFAULT_FEE_LIMIT = 15_000_000
