import { isValidMigrationSource } from '@/config/dataMigration'
import { chainBuilder } from '@/tests/builders/chains'

describe('isValidMigrationSource', () => {
  const chains = [
    chainBuilder().with({ chainId: '88888', shortName: 'chzmainnet' }).build(),
    chainBuilder().with({ chainId: '1', shortName: 'eth' }).build(),
  ]

  it('accepts short names of gateway chain configs', () => {
    expect(isValidMigrationSource('chzmainnet', chains)).toBe(true)
    expect(isValidMigrationSource('eth', chains)).toBe(true)
  })

  it('rejects short names unknown to the gateway', () => {
    expect(isValidMigrationSource('chiliz', chains)).toBe(false)
    expect(isValidMigrationSource('evil.example.com', chains)).toBe(false)
  })

  it('rejects an empty/undefined source', () => {
    expect(isValidMigrationSource(undefined, chains)).toBe(false)
    expect(isValidMigrationSource('', chains)).toBe(false)
  })

  it('rejects everything while no chain configs are loaded', () => {
    expect(isValidMigrationSource('chzmainnet', [])).toBe(false)
  })

  it('does not match inherited object properties', () => {
    expect(isValidMigrationSource('constructor', chains)).toBe(false)
    expect(isValidMigrationSource('__proto__', chains)).toBe(false)
  })
})
