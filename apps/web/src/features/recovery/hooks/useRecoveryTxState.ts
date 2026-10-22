import { useClock } from './useClock'
import { selectDelayModifierByAddress } from '@/features/recovery/services/selectors'
import recoveryStore from '@/features/recovery/components/RecoveryContext'
import type { AnyRecoveryQueueItem } from '@/features/recovery/services/recovery-state'

export function useRecoveryTxState({ validFrom, expiresAt, args, address }: AnyRecoveryQueueItem): {
  isNext: boolean
  isExecutable: boolean
  isExpired: boolean
  isPending: boolean
  remainingSeconds: number
} {
  const { state, pending } = recoveryStore.useStore() || {}
  const recovery = state?.[0]
  const delayModifier = recovery && selectDelayModifierByAddress(recovery, address)

  // We don't display seconds in the interface, so we can use a 60s interval
  const timestamp = useClock(60_000)
  const remainingMs = Number(validFrom) - timestamp

  const isValid = remainingMs <= 0
  const isExpired = expiresAt !== null ? Number(expiresAt) <= Date.now() : false

  const isNext = !delayModifier || BigInt(args.queueNonce) === BigInt(delayModifier.txNonce)
  const isExecutable = isNext && isValid && !isExpired
  const isPending = !!pending?.[args.txHash]

  const remainingSeconds = isValid ? 0 : Math.ceil(remainingMs / 1_000)

  return { isNext, isExecutable, isExpired, remainingSeconds, isPending }
}
