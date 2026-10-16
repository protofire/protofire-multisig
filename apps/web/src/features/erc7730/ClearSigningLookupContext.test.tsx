import type { DisplayModel } from '@ethereum-sourcify/clear-signing'
import { act, render, waitFor } from '@/tests/test-utils'
import * as useChains from '@/hooks/useChains'
import { ERC7730_EVENTS, trackEvent } from '@/services/analytics'
import {
  ClearSigningLookupProvider,
  useClearSigningLookupContext,
  useClearSigningLookupSummary,
  type ClearSigningLookupContextValue,
  type ClearSigningLookupResultData,
  type ClearSigningLookupSummary,
} from './ClearSigningLookupContext'

jest.mock('@/services/analytics', () => ({
  ...jest.requireActual('@/services/analytics'),
  trackEvent: jest.fn(),
}))

beforeEach(() => {
  jest.spyOn(useChains, 'useHasFeature').mockReturnValue(true)
  jest.mocked(trackEvent).mockClear()
})

const foundModel = { intent: 'Send' } as DisplayModel

const deferred = <T,>() => {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

type Probe = {
  summary: ClearSigningLookupSummary | null
  context: ClearSigningLookupContextValue | null
}

const Reader = ({ onValue }: { onValue: (probe: Probe) => void }): null => {
  onValue({ summary: useClearSigningLookupSummary(), context: useClearSigningLookupContext() })
  return null
}

const renderProbe = () => {
  let latest: Probe | undefined
  render(
    <ClearSigningLookupProvider>
      <Reader onValue={(probe) => (latest = probe)} />
    </ClearSigningLookupProvider>,
  )
  const probe = () => latest as Probe
  const register = (key: string, eligible = true, run?: () => Promise<ClearSigningLookupResultData>) =>
    act(() => probe().context?.registerEntry(key, { label: `Label ${key}`, eligible, run }))
  const subscribe = (key: string) => {
    let release: (() => void) | undefined
    act(() => (release = probe().context?.subscribeEntry(key)))
    return () => act(() => release?.())
  }
  return { probe, register, subscribe }
}

describe('useClearSigningLookupSummary', () => {
  it('returns null without a provider', () => {
    let summary: ClearSigningLookupSummary | null = null
    const Probe = (): null => {
      summary = useClearSigningLookupSummary()
      return null
    }
    render(<Probe />)

    expect(summary).toBeNull()
  })

  it('returns null until an eligible entry is registered', () => {
    const { probe, register } = renderProbe()
    expect(probe().summary).toBeNull()

    register('ineligible', false)
    expect(probe().summary).toBeNull()

    register('key-1')
    expect(probe().summary).toMatchObject({ isMultiAction: false, isAnyLoading: false, allDone: false, doneCount: 0 })
    expect(probe().summary?.primaryEntry.key).toBe('key-1')
  })

  it('aggregates status and outcome across eligible entries', async () => {
    const { probe, register } = renderProbe()
    const first = deferred<ClearSigningLookupResultData>()
    const second = deferred<ClearSigningLookupResultData>()
    register('key-1', true, () => first.promise)
    register('key-2', true, () => second.promise)
    expect(probe().summary).toMatchObject({ isMultiAction: true, allDone: false })

    act(() => probe().summary?.requestLookups())
    expect(probe().summary?.isAnyLoading).toBe(true)

    await act(async () => {
      first.resolve({ model: foundModel })
      second.resolve({})
    })
    await waitFor(() =>
      expect(probe().summary).toMatchObject({ isAnyLoading: false, allDone: true, doneCount: 2, foundCount: 1 }),
    )
  })
})

describe('ClearSigningLookupProvider', () => {
  it('renders children without a context when the feature flag is off', () => {
    jest.spyOn(useChains, 'useHasFeature').mockReturnValue(false)
    const { probe } = renderProbe()

    expect(probe().context).toBeNull()
    expect(probe().summary).toBeNull()
  })

  it('stores the result of a lookup on its entry and reports a failed run as an error', async () => {
    const { probe, register } = renderProbe()
    register('ok', true, async () => ({ model: foundModel, descriptorPath: 'registry/acme/calldata.json' }))
    register('broken', true, async () => {
      throw new Error('boom')
    })

    act(() => probe().context?.requestAllLookups())

    await waitFor(() => expect(probe().context?.entries.ok).toMatchObject({ status: 'done', outcome: 'found' }))
    expect(probe().context?.entries.ok.descriptorPath).toBe('registry/acme/calldata.json')
    expect(probe().context?.entries.broken).toMatchObject({ status: 'done', outcome: 'error' })
    expect(probe().context?.entries.broken.error?.message).toBe('boom')
  })

  it('tracks each requested lookup and its outcome', async () => {
    const { probe, register } = renderProbe()
    register('found', true, async () => ({ model: foundModel }))
    register('missing', true, async () => ({}))
    register('broken', true, async () => {
      throw new Error('boom')
    })

    act(() => probe().context?.requestAllLookups())
    await waitFor(() => expect(probe().summary?.allDone).toBe(true))

    expect(jest.mocked(trackEvent).mock.calls).toEqual(
      expect.arrayContaining([
        [ERC7730_EVENTS.LOOKUP_REQUESTED],
        [{ ...ERC7730_EVENTS.LOOKUP_RESULT, label: 'found' }],
        [{ ...ERC7730_EVENTS.LOOKUP_RESULT, label: 'not_found' }],
        [{ ...ERC7730_EVENTS.LOOKUP_RESULT, label: 'error' }],
      ]),
    )
    expect(
      jest.mocked(trackEvent).mock.calls.filter(([event]) => event === ERC7730_EVENTS.LOOKUP_REQUESTED),
    ).toHaveLength(3)
  })

  it('runs each lookup once while it is in flight and does not re-run finished lookups', async () => {
    const { probe, register } = renderProbe()
    const run = jest.fn(async () => ({}))
    register('key-1', true, run)

    act(() => {
      probe().context?.requestLookup('key-1')
      probe().context?.requestLookup('key-1')
    })
    await waitFor(() => expect(probe().context?.entries['key-1'].status).toBe('done'))
    act(() => probe().context?.requestAllLookups())

    expect(run).toHaveBeenCalledTimes(1)
  })

  it('drops the result of a lookup whose last subscriber left meanwhile', async () => {
    const { probe, register } = renderProbe()
    const pending = deferred<ClearSigningLookupResultData>()
    let release: (() => void) | undefined
    act(() => (release = probe().context?.subscribeEntry('key-1')))
    register('key-1', true, () => pending.promise)
    act(() => probe().context?.requestLookup('key-1'))

    act(() => release?.())
    await act(async () => pending.resolve({ model: foundModel }))

    expect(probe().context?.entries['key-1']).toBeUndefined()
    expect(probe().summary).toBeNull()
  })

  it('keeps a shared entry until its last subscriber is released, whichever order they arrived in', async () => {
    const { probe, register, subscribe } = renderProbe()
    const releaseFirst = subscribe('shared')
    register('shared', true, async () => ({ model: foundModel }))
    const releaseSecond = subscribe('shared')
    act(() => probe().context?.requestLookup('shared'))
    await waitFor(() => expect(probe().context?.entries.shared.outcome).toBe('found'))

    releaseFirst()
    expect(probe().context?.entries.shared).toMatchObject({ status: 'done', outcome: 'found' })

    releaseSecond()
    expect(probe().context?.entries.shared).toBeUndefined()
  })

  it('ignores a release that is called more than once', () => {
    const { probe, register, subscribe } = renderProbe()
    const releaseFirst = subscribe('shared')
    const releaseSecond = subscribe('shared')
    register('shared')

    releaseFirst()
    releaseFirst()

    expect(probe().context?.entries.shared).toBeDefined()

    releaseSecond()
    expect(probe().context?.entries.shared).toBeUndefined()
  })

  it('keeps the lookup state when an entry is re-registered with the same label', async () => {
    const { probe, register } = renderProbe()
    register('key-1', true, async () => ({ model: foundModel }))
    act(() => probe().context?.requestLookup('key-1'))
    await waitFor(() => expect(probe().context?.entries['key-1'].outcome).toBe('found'))

    register('key-1', true, async () => ({}))

    expect(probe().context?.entries['key-1']).toMatchObject({ status: 'done', outcome: 'found' })
  })
})
