import type { DisplayModel, ExternalDataProvider } from '@ethereum-sourcify/clear-signing'
import { asError } from '@safe-global/utils/services/exceptions/utils'
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react'
import { ERC7730_EVENTS, trackEvent } from '@/services/analytics'
import { Errors, logError } from '@/services/exceptions'
import type { ClearSigningAttestationResult } from './erc8176/attestation'
import { useClearSigningLookupEnabled } from './eligibility'
import { useClearSigningExternalDataProvider } from './externalDataProvider'

export type ClearSigningLookupStatus = 'idle' | 'loading' | 'done'

export type ClearSigningLookupOutcome = 'found' | 'not_found' | 'error'

export interface ClearSigningLookupResultData extends ClearSigningAttestationResult {
  model?: DisplayModel
}

export type ClearSigningLookupRunner = (
  externalDataProvider: ExternalDataProvider,
) => Promise<ClearSigningLookupResultData>

export interface ClearSigningLookupEntry extends ClearSigningLookupResultData {
  label: string
  eligible: boolean
  status: ClearSigningLookupStatus
  outcome?: ClearSigningLookupOutcome
  error?: Error
}

export interface ClearSigningLookupRegistration {
  label: string
  eligible: boolean
  run?: ClearSigningLookupRunner
}

interface ClearSigningLookupKeyedEntry {
  key: string
  entry: ClearSigningLookupEntry
}

type Entries = Record<string, ClearSigningLookupEntry>

const getEligibleKeys = (entries: Entries): string[] =>
  Object.entries(entries)
    .filter(([, entry]) => entry.eligible)
    .map(([key]) => key)

const patchEntry =
  (key: string, patch: Partial<ClearSigningLookupEntry>) =>
  (entries: Entries): Entries => {
    const entry = entries[key]
    return entry ? { ...entries, [key]: { ...entry, ...patch } } : entries
  }

const EMPTY_LOOKUP_RESULT: Record<keyof ClearSigningLookupResultData, undefined> = {
  model: undefined,
  descriptorPath: undefined,
  attestation: undefined,
}

const toOutcome = ({ model }: ClearSigningLookupResultData): ClearSigningLookupOutcome =>
  model ? 'found' : 'not_found'

export interface ClearSigningLookupContextValue {
  entries: Entries
  eligibleKeyedEntries: ClearSigningLookupKeyedEntry[]
  registerEntry: (key: string, registration: ClearSigningLookupRegistration) => void
  subscribeEntry: (key: string) => () => void
  requestLookup: (key: string) => void
  requestAllLookups: () => void
}

const ClearSigningLookupContext = createContext<ClearSigningLookupContextValue | null>(null)

export const ClearSigningLookupProvider = ({ children }: { children: ReactNode }): ReactElement => {
  const isEnabled = useClearSigningLookupEnabled()
  const [entries, setEntries] = useState<Entries>({})
  const externalDataProvider = useClearSigningExternalDataProvider()
  const runnersRef = useRef(new Map<string, ClearSigningLookupRunner>())
  const inFlightRef = useRef(new Set<string>())
  const subscriberCountsRef = useRef(new Map<string, number>())

  const registerEntry = useCallback((key: string, { label, eligible, run }: ClearSigningLookupRegistration) => {
    if (run) {
      runnersRef.current.set(key, run)
    } else {
      runnersRef.current.delete(key)
    }
    setEntries((prev) => {
      const existing = prev[key]
      if (existing && existing.label === label && existing.eligible === eligible) {
        return prev
      }
      return { ...prev, [key]: { ...(existing ?? { status: 'idle' }), label, eligible } }
    })
  }, [])

  const removeEntry = useCallback((key: string) => {
    runnersRef.current.delete(key)
    setEntries((prev) => {
      if (!(key in prev)) {
        return prev
      }
      const { [key]: _removed, ...rest } = prev
      return rest
    })
  }, [])

  const subscribeEntry = useCallback(
    (key: string) => {
      const counts = subscriberCountsRef.current
      counts.set(key, (counts.get(key) ?? 0) + 1)
      let released = false
      return () => {
        if (released) {
          return
        }
        released = true
        const remaining = Math.max((counts.get(key) ?? 0) - 1, 0)
        if (remaining > 0) {
          counts.set(key, remaining)
          return
        }
        counts.delete(key)
        removeEntry(key)
      }
    },
    [removeEntry],
  )

  const requestLookup = useCallback(
    (key: string) => {
      const run = runnersRef.current.get(key)
      if (!run || inFlightRef.current.has(key)) {
        return
      }
      inFlightRef.current.add(key)
      trackEvent(ERC7730_EVENTS.LOOKUP_REQUESTED)
      setEntries(
        patchEntry(key, {
          status: 'loading',
          outcome: undefined,
          error: undefined,
          ...EMPTY_LOOKUP_RESULT,
        }),
      )
      run(externalDataProvider)
        .then((result) => {
          const outcome = toOutcome(result)
          trackEvent({ ...ERC7730_EVENTS.LOOKUP_RESULT, label: outcome })
          setEntries(patchEntry(key, { ...result, status: 'done', outcome }))
        })
        .catch((thrown: unknown) => {
          logError(Errors._809, thrown)
          trackEvent({ ...ERC7730_EVENTS.LOOKUP_RESULT, label: 'error' })
          setEntries(patchEntry(key, { status: 'done', outcome: 'error', error: asError(thrown) }))
        })
        .finally(() => inFlightRef.current.delete(key))
    },
    [externalDataProvider],
  )

  const requestAllLookups = useCallback(() => {
    getEligibleKeys(entries)
      .filter((key) => entries[key].status === 'idle')
      .forEach(requestLookup)
  }, [entries, requestLookup])

  const eligibleKeyedEntries = useMemo(
    () => getEligibleKeys(entries).map((key) => ({ key, entry: entries[key] })),
    [entries],
  )

  const value = useMemo(
    (): ClearSigningLookupContextValue => ({
      entries,
      eligibleKeyedEntries,
      registerEntry,
      subscribeEntry,
      requestLookup,
      requestAllLookups,
    }),
    [entries, eligibleKeyedEntries, registerEntry, subscribeEntry, requestLookup, requestAllLookups],
  )

  return (
    <ClearSigningLookupContext.Provider value={isEnabled ? value : null}>{children}</ClearSigningLookupContext.Provider>
  )
}

export const useClearSigningLookupContext = (): ClearSigningLookupContextValue | null =>
  useContext(ClearSigningLookupContext)

export interface ClearSigningLookupSummary {
  lookupContext: ClearSigningLookupContextValue
  eligibleKeyedEntries: ClearSigningLookupKeyedEntry[]
  primaryEntry: ClearSigningLookupKeyedEntry
  isMultiAction: boolean
  isAnyLoading: boolean
  allDone: boolean
  doneCount: number
  foundCount: number
  requestLookups: () => void
}

const summarize = (lookupContext: ClearSigningLookupContextValue): ClearSigningLookupSummary | null => {
  const { eligibleKeyedEntries } = lookupContext
  if (eligibleKeyedEntries.length === 0) {
    return null
  }

  const entries = eligibleKeyedEntries.map(({ entry }) => entry)
  const doneCount = entries.filter((entry) => entry.status === 'done').length
  const primaryEntry = eligibleKeyedEntries[0]
  const isMultiAction = eligibleKeyedEntries.length > 1

  return {
    lookupContext,
    eligibleKeyedEntries,
    primaryEntry,
    isMultiAction,
    isAnyLoading: entries.some((entry) => entry.status === 'loading'),
    allDone: doneCount === entries.length,
    doneCount,
    foundCount: entries.filter((entry) => entry.outcome === 'found').length,
    requestLookups: isMultiAction
      ? lookupContext.requestAllLookups
      : () => lookupContext.requestLookup(primaryEntry.key),
  }
}

export const useClearSigningLookupSummary = (): ClearSigningLookupSummary | null => {
  const lookupContext = useClearSigningLookupContext()

  return useMemo(() => (lookupContext ? summarize(lookupContext) : null), [lookupContext])
}
