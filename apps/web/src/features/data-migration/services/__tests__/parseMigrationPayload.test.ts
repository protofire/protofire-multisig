import { ImportErrors } from '@/components/settings/DataManagement/useGlobalImportFileParser'
import { parseMigrationPayload } from '../parseMigrationPayload'

describe('parseMigrationPayload', () => {
  it('validates and sanitizes address book entries the same way the manual import does', () => {
    const validAddress = '0xAecDFD3A19f777F0c03e6bf99AAfB59937d6467b'

    const result = parseMigrationPayload({
      addressBook: { '1': { [validAddress]: 'Alice', invalidAddress: 'Should be dropped' } },
    })

    expect(result.error).toBeUndefined()
    expect(result.addressBook).toStrictEqual({ '1': { [validAddress]: 'Alice' } })
    expect(result.addressBookEntriesCount).toEqual(1)
  })

  it('reports no importable data for an empty bridge payload', () => {
    const result = parseMigrationPayload({})

    expect(result.error).toEqual(ImportErrors.NO_IMPORT_DATA_FOUND)
  })

  it('carries settings through untouched', () => {
    const result = parseMigrationPayload({ settings: { currency: 'usd' } as never })

    expect(result.settings).toEqual({ currency: 'usd' })
  })

  it('drops pinned safe apps, since their ids differ between gateway catalogues', () => {
    const result = parseMigrationPayload({
      settings: { currency: 'usd' } as never,
      safeApps: { '1': { pinned: [1, 2] } } as never,
    })

    expect(result.safeApps).toBeUndefined()
    expect(result.settings).toEqual({ currency: 'usd' })
  })

  it('reports no importable data when the payload only holds pinned safe apps', () => {
    const result = parseMigrationPayload({ safeApps: { '1': { pinned: [6], opened: [] } } as never })

    expect(result.error).toEqual(ImportErrors.NO_IMPORT_DATA_FOUND)
  })
})
