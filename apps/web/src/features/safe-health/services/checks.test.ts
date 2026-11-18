import { SAFE_FEATURES } from '@safe-global/protocol-kit/dist/src/utils/safeVersions'
import { getCompatibilityFallbackHandlerDeployments } from '@safe-global/safe-deployments'
import type * as SafeDeployments from '@safe-global/safe-deployments'
import type { AddressInfo } from '@safe-global/store/gateway/AUTO_GENERATED/safes'
import { ImplementationVersionState } from '@safe-global/store/gateway/types'
import type { AsyncResult } from '@safe-global/utils/hooks/useAsync'
import { addressExBuilder } from '@/tests/builders/safe'
import { hasSafeFeature } from '@/utils/safe-versions'
import {
  getFallbackHandlerCheck,
  getGuardCheck,
  getModulesCheck,
  getOwnersCheck,
  getRecoveryCheck,
  getVersionCheck,
  hasKnownFallbackHandlerList,
} from './checks'

jest.mock('@safe-global/safe-deployments', () => ({
  ...jest.requireActual('@safe-global/safe-deployments'),
  getCompatibilityFallbackHandlerDeployments: jest.fn(),
}))

const mockDeployments = getCompatibilityFallbackHandlerDeployments as jest.MockedFunction<
  typeof getCompatibilityFallbackHandlerDeployments
>

const address = (overrides: Partial<AddressInfo> = {}): AddressInfo => ({ ...addressExBuilder().build(), ...overrides })

describe('getOwnersCheck', () => {
  it.each([
    [1, 1, 'one_of_one', 'info', '1 out of 1 signer must confirm'],
    [3, 1, 'one_of_n', 'info', '1 out of 3 signers must confirm'],
    [3, 3, 'n_of_n', 'info', '3 out of 3 signers must confirm'],
    [3, 2, 'ok', 'ok', '2 out of 3 signers must confirm'],
  ])('%i owners, threshold %i -> %s', (owners, threshold, state, status, summary) => {
    expect(getOwnersCheck(owners, threshold)).toMatchObject({ id: 'owners', state, status, summary })
  })
})

describe('getVersionCheck', () => {
  const { UP_TO_DATE, UNKNOWN } = ImplementationVersionState

  it('flags an unknown mastercopy before trusting its reported version', () => {
    expect(getVersionCheck('1.4.1', '1.4.1', true, false, UNKNOWN)).toMatchObject({
      state: 'unsupported',
      status: 'info',
      summary: 'Unsupported contract version',
    })
  })

  it('is loading while the mastercopy list is loading', () => {
    expect(getVersionCheck('1.1.1', '1.4.1', true, undefined, UP_TO_DATE)).toMatchObject({
      state: 'loading',
      status: 'loading',
    })
  })

  it('is not recognised without a version', () => {
    expect(getVersionCheck(null, '1.4.1', true, false, UP_TO_DATE).state).toBe('not_recognised')
  })

  it('is not recognised for an invalid version', () => {
    expect(getVersionCheck('abc', '1.4.1', true, false, UP_TO_DATE).state).toBe('not_recognised')
  })

  it('could not be checked while the chain is missing', () => {
    expect(getVersionCheck('1.4.1', '1.4.1', false, false, UP_TO_DATE)).toMatchObject({
      state: 'could_not_check',
      status: 'info',
    })
  })

  it('ticks Circles without an update hint', () => {
    expect(getVersionCheck('1.1.1', '1.4.1', true, true, UP_TO_DATE)).toEqual({
      id: 'version',
      title: 'Contract version',
      state: 'circles',
      status: 'ok',
      summary: 'Version 1.1.1',
    })
  })

  it('is up to date on the latest version', () => {
    expect(getVersionCheck('1.4.1', '1.4.1', true, false, UP_TO_DATE)).toMatchObject({
      state: 'up_to_date',
      status: 'ok',
      summary: 'Version 1.4.1, up to date',
    })
  })

  it('treats 1.3.0+L2 as an optional update when the latest is 1.4.1', () => {
    expect(getVersionCheck('1.3.0+L2', '1.4.1', true, false, UP_TO_DATE)).toMatchObject({
      state: 'update_available',
      status: 'ok',
      detail: 'Version 1.4.1 is available, optional.',
    })
  })

  it.each(['1.1.1', '1.2.0'])('flags %s as below the minimum version', (version) => {
    expect(getVersionCheck(version, '1.4.1', true, false, UP_TO_DATE)).toMatchObject({
      state: 'below_min',
      status: 'info',
      detail: 'Versions before 1.3.0 miss newer features. Version 1.4.1 is available.',
    })
  })
})

describe('getModulesCheck', () => {
  const recovery = address()
  const other = address()

  it('ticks when no modules are enabled', () => {
    expect(getModulesCheck([], [])).toMatchObject({ state: 'none', status: 'ok' })
    expect(getModulesCheck(null, [])).toMatchObject({ state: 'none', status: 'ok' })
  })

  it('is loading while recovery is loading', () => {
    expect(getModulesCheck([recovery], undefined)).toMatchObject({ state: 'loading', status: 'loading' })
  })

  it('ticks when the only module is a known recovery module', () => {
    expect(getModulesCheck([recovery], [recovery.value.toLowerCase()])).toMatchObject({
      state: 'recovery_only',
      status: 'ok',
      summary: '1 module: Account recovery',
    })
  })

  it('lists the modules when another module is enabled', () => {
    expect(getModulesCheck([recovery, other], [recovery.value])).toMatchObject({
      state: 'listed',
      status: 'info',
      summary: '2 modules enabled',
      items: [recovery, other],
    })
  })

  it('keeps unnamed modules in the list', () => {
    const unnamed = address({ name: null })
    expect(getModulesCheck([unnamed], [])).toMatchObject({ state: 'listed', items: [unnamed] })
  })
})

describe('getGuardCheck', () => {
  it.each(['1.1.1', null])('is not supported for version %s', (version) => {
    const supportsGuards = hasSafeFeature(SAFE_FEATURES.SAFE_TX_GUARDS, version)
    expect(getGuardCheck(null, supportsGuards)).toMatchObject({ state: 'not_supported', status: 'info' })
  })

  it.each(['1.1.1', null])('shows a set guard even for version %s', (version) => {
    const guard = address({ name: 'My guard' })
    const supportsGuards = hasSafeFeature(SAFE_FEATURES.SAFE_TX_GUARDS, version)
    expect(getGuardCheck(guard, supportsGuards)).toMatchObject({ state: 'listed', status: 'info', items: [guard] })
  })

  it('ticks when no guard is set', () => {
    expect(getGuardCheck(null, true)).toMatchObject({ state: 'none', status: 'ok' })
  })

  it('shows the guard without a verdict', () => {
    const guard = address({ name: 'My guard' })
    expect(getGuardCheck(guard, true)).toMatchObject({
      state: 'listed',
      status: 'info',
      summary: 'Guard: My guard',
      items: [guard],
    })
  })

  it('falls back to a shortened address for an unnamed guard', () => {
    const guard = address({ name: null, value: '0x1234567890123456789012345678901234567890' })
    expect(getGuardCheck(guard, true).summary).toBe('Guard: 0x1234...7890')
  })
})

describe('getFallbackHandlerCheck', () => {
  const handler = address({ name: 'CompatibilityFallbackHandler' })

  it('is not supported before 1.1.1', () => {
    expect(getFallbackHandlerCheck('1.0.0', handler, false, true).state).toBe('not_supported')
  })

  it('reports a missing handler instead of a tick', () => {
    expect(getFallbackHandlerCheck('1.4.1', null, false, true)).toMatchObject({ state: 'none', status: 'info' })
  })

  it('ticks a known handler with its name', () => {
    expect(getFallbackHandlerCheck('1.4.1', handler, false, true)).toMatchObject({
      state: 'known',
      status: 'ok',
      summary: 'CompatibilityFallbackHandler',
    })
  })

  it('falls back to a generic name for an unnamed known handler', () => {
    expect(getFallbackHandlerCheck('1.4.1', address({ name: null }), false, true).summary).toBe('Known handler')
  })

  it('reports an untrusted handler on 1.3.0 as not in the list', () => {
    expect(getFallbackHandlerCheck('1.3.0', handler, true, true)).toMatchObject({
      state: 'not_in_list',
      status: 'info',
    })
  })

  it.each(['1.5.0', '1.1.1'])('could not verify an untrusted handler on %s', (version) => {
    expect(getFallbackHandlerCheck(version, handler, true, true).state).toBe('could_not_verify')
  })

  it('could not verify an untrusted handler without a known list', () => {
    expect(getFallbackHandlerCheck('1.4.1', handler, true, false).state).toBe('could_not_verify')
  })
})

describe('hasKnownFallbackHandlerList', () => {
  const actual = jest.requireActual<typeof SafeDeployments>('@safe-global/safe-deployments')

  it('is true for a network with deployments', () => {
    mockDeployments.mockImplementation(actual.getCompatibilityFallbackHandlerDeployments)

    expect(hasKnownFallbackHandlerList('1')).toBe(true)
  })

  it('is false when no deployment lists the network', () => {
    mockDeployments.mockReturnValue(undefined)

    expect(hasKnownFallbackHandlerList('1')).toBe(false)
  })
})

describe('getRecoveryCheck', () => {
  const currentModule = address()
  const otherSafeModule = address()
  type Item = { address: string; delay: bigint }
  const state = (data: Item[] | undefined, error: Error | undefined, loading: boolean): AsyncResult<Item[]> => [
    data,
    error,
    loading,
  ]
  const match = [{ address: currentModule.value.toLowerCase(), delay: 86400n }]

  it('is not available on unsupported networks, even with stale data', () => {
    expect(getRecoveryCheck(false, [currentModule], state(match, undefined, false))).toMatchObject({
      state: 'not_available',
      status: 'info',
    })
  })

  it('is not set up without modules', () => {
    expect(getRecoveryCheck(true, [], state(match, undefined, false)).state).toBe('no_modules')
    expect(getRecoveryCheck(true, null, state(match, undefined, false)).state).toBe('no_modules')
  })

  it('shows loading before stale data', () => {
    expect(getRecoveryCheck(true, [currentModule], state(match, undefined, true))).toMatchObject({
      state: 'loading',
      status: 'loading',
    })
  })

  it('ticks when recovery data matches a current module', () => {
    expect(getRecoveryCheck(true, [currentModule], state(match, undefined, false))).toMatchObject({
      state: 'set_up',
      status: 'ok',
    })
  })

  it('does not tick a recovery module without a review period', () => {
    expect(
      getRecoveryCheck(true, [currentModule], state([{ ...match[0], delay: 0n }], undefined, false)),
    ).toMatchObject({
      state: 'no_delay',
      status: 'info',
    })
  })

  it('does not tick for recovery data of another Safe', () => {
    expect(getRecoveryCheck(true, [otherSafeModule], state(match, undefined, false))).toMatchObject({
      state: 'not_found',
      status: 'info',
      summary: 'No recovery module found',
    })
  })

  it('could not check after a lookup error', () => {
    expect(getRecoveryCheck(true, [currentModule], state(undefined, new Error('rpc'), false)).state).toBe(
      'could_not_check',
    )
  })

  it('could not check when a lookup error keeps stale data', () => {
    expect(getRecoveryCheck(true, [currentModule], state(match, new Error('rpc'), false))).toMatchObject({
      state: 'could_not_check',
      status: 'info',
    })
  })

  it('is not found when the lookup returns nothing', () => {
    expect(getRecoveryCheck(true, [currentModule], state([], undefined, false)).state).toBe('not_found')
  })
})
