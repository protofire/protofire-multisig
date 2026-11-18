import { renderHook } from '@testing-library/react'
import type { SafeState } from '@safe-global/store/gateway/AUTO_GENERATED/safes'
import { ImplementationVersionState } from '@safe-global/store/gateway/types'
import type { AsyncResult } from '@safe-global/utils/hooks/useAsync'
import { useCurrentChain } from '@/hooks/useChains'
import { useHasUntrustedFallbackHandler } from '@/hooks/useHasUntrustedFallbackHandler'
import { MasterCopyDeployer, useMasterCopies, type MasterCopy } from '@/hooks/useMasterCopies'
import useSafeInfo from '@/hooks/useSafeInfo'
import {
  useIsRecoveryLoaded,
  useIsRecoverySupported,
  useRecovery,
  useRecoveryDelayModifiersError,
  type RecoveryState,
} from '@/features/recovery'
import { chainBuilder } from '@/tests/builders/chains'
import { addressExBuilder, extendedSafeInfoBuilder } from '@/tests/builders/safe'
import type { CheckId } from '../services/checks'
import { useSafeHealthChecks } from './useSafeHealthChecks'

jest.mock('@/hooks/useSafeInfo')
jest.mock('@/hooks/useChains', () => ({ useCurrentChain: jest.fn() }))
jest.mock('@/hooks/useHasUntrustedFallbackHandler', () => ({ useHasUntrustedFallbackHandler: jest.fn() }))
jest.mock('@/hooks/useMasterCopies', () => ({
  ...jest.requireActual('@/hooks/useMasterCopies'),
  useMasterCopies: jest.fn(),
}))
jest.mock('@/features/recovery', () => ({
  useIsRecoveryLoaded: jest.fn(),
  useIsRecoverySupported: jest.fn(),
  useRecovery: jest.fn(),
  useRecoveryDelayModifiersError: jest.fn(),
}))

const implementation = addressExBuilder().build()
const recoveryModule = addressExBuilder().build()
const recoveryItem = { address: recoveryModule.value, delay: 86400n } as RecoveryState[number]

type Setup = {
  safe?: Partial<SafeState>
  deployer?: MasterCopyDeployer
  masterCopiesLoading?: boolean
  recovery?: AsyncResult<RecoveryState>
  recoveryLoaded?: boolean
  delayModifiersError?: Error
}

const setup = ({
  safe = {},
  deployer = MasterCopyDeployer.GNOSIS,
  masterCopiesLoading = false,
  recovery = [[recoveryItem], undefined, false],
  recoveryLoaded = true,
  delayModifiersError,
}: Setup = {}) => {
  const masterCopy: MasterCopy = { address: implementation.value, version: '1.4.1', deployer, deployerRepoUrl: '' }

  jest.mocked(useSafeInfo).mockReturnValue({
    safe: extendedSafeInfoBuilder()
      .with({
        chainId: '1',
        version: '1.4.1',
        implementation,
        implementationVersionState: ImplementationVersionState.UP_TO_DATE,
        modules: [recoveryModule],
        ...safe,
      })
      .build(),
    safeAddress: '',
    safeLoaded: true,
    safeLoading: false,
  })
  jest.mocked(useCurrentChain).mockReturnValue(chainBuilder().with({ chainId: '1' }).build())
  jest.mocked(useHasUntrustedFallbackHandler).mockReturnValue(false)
  jest
    .mocked(useMasterCopies)
    .mockReturnValue(masterCopiesLoading ? [undefined, undefined, true] : [[masterCopy], undefined, false])
  jest.mocked(useIsRecoverySupported).mockReturnValue(true)
  jest.mocked(useRecovery).mockReturnValue(recovery)
  jest.mocked(useIsRecoveryLoaded).mockReturnValue(recoveryLoaded)
  jest.mocked(useRecoveryDelayModifiersError).mockReturnValue(delayModifiersError)

  const { checks, hideVersionOnHome } = renderHook(() => useSafeHealthChecks()).result.current
  const stateOf = (id: CheckId) => checks.find((check) => check.id === id)?.state
  return { stateOf, hideVersionOnHome }
}

describe('useSafeHealthChecks', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('ticks a recovery-only Safe once recovery has loaded', () => {
    const { stateOf } = setup()

    expect(stateOf('modules')).toBe('recovery_only')
    expect(stateOf('recovery')).toBe('set_up')
  })

  it('hides the version row on Home when the attention panel shows the update', () => {
    const { hideVersionOnHome } = setup({
      safe: { version: '1.1.1', implementationVersionState: ImplementationVersionState.OUTDATED },
    })

    expect(hideVersionOnHome).toBe(true)
  })

  it('does not hide the version row for a Circles mastercopy', () => {
    const { stateOf, hideVersionOnHome } = setup({
      safe: { version: '1.1.1', implementationVersionState: ImplementationVersionState.OUTDATED },
      deployer: MasterCopyDeployer.CIRCLES,
    })

    expect(stateOf('version')).toBe('circles')
    expect(hideVersionOnHome).toBe(false)
  })

  it('shows the version as loading while the mastercopies load', () => {
    const { stateOf } = setup({ safe: { version: '1.1.1' }, masterCopiesLoading: true })

    expect(stateOf('version')).toBe('loading')
  })

  it.each([
    ['the recovery store is not written yet', { recovery: [undefined, undefined, false], recoveryLoaded: false }],
    ['recovery is loading', { recovery: [undefined, undefined, true] }],
  ] as [string, Setup][])('does not treat modules as recovery while %s', (_, overrides) => {
    const { stateOf } = setup(overrides)

    expect(stateOf('modules')).toBe('loading')
    expect(stateOf('recovery')).toBe('loading')
  })

  it('does not treat modules as recovery when recovery failed', () => {
    const { stateOf } = setup({ recovery: [[recoveryItem], new Error('rpc'), false] })

    expect(stateOf('modules')).toBe('listed')
    expect(stateOf('recovery')).toBe('could_not_check')
  })

  it('reports could_not_check when the Delay Modifiers lookup fails', () => {
    const { stateOf } = setup({ recovery: [undefined, undefined, false], delayModifiersError: new Error('rpc') })

    expect(stateOf('modules')).toBe('listed')
    expect(stateOf('recovery')).toBe('could_not_check')
  })

  it('flags an UNKNOWN implementation as unsupported', () => {
    const { stateOf } = setup({ safe: { implementationVersionState: ImplementationVersionState.UNKNOWN } })

    expect(stateOf('version')).toBe('unsupported')
  })
})
