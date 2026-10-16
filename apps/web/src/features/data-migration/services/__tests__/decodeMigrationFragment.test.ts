import { decodeMigrationFragment, MigrationDecodeFailure, type MigrationPayload } from '../decodeMigrationFragment'

// Mirrors the sending app's `encodeMigration` - kept local to this test so it stays an
// independent check of the wire format, not a reuse of the implementation under test.
const encodeMigration = async (data: unknown): Promise<string> => {
  const bytes = new TextEncoder().encode(JSON.stringify(data))
  const gz = await new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer()
  const b64 = btoa(String.fromCharCode(...new Uint8Array(gz)))
  return 'v1.' + b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

describe('decodeMigrationFragment', () => {
  it('round-trips a payload encoded the same way the sending app does', async () => {
    const payload: MigrationPayload = {
      addressBook: { '1': { '0xAecDFD3A19f777F0c03e6bf99AAfB59937d6467b': 'Alice' } },
      settings: { currency: 'usd' } as never,
    }

    const hash = '#' + (await encodeMigration(payload))

    await expect(decodeMigrationFragment(hash)).resolves.toEqual(payload)
  })

  it('works without a leading #', async () => {
    const payload: MigrationPayload = { safeApps: { '1': { pinned: [1] } } }
    const encoded = await encodeMigration(payload)

    await expect(decodeMigrationFragment(encoded)).resolves.toEqual(payload)
  })

  it('rejects an empty fragment', async () => {
    await expect(decodeMigrationFragment('')).rejects.toMatchObject({ reason: 'no-fragment' })
    await expect(decodeMigrationFragment('#')).rejects.toMatchObject({ reason: 'no-fragment' })
  })

  it('rejects an unsupported version prefix', async () => {
    const encoded = await encodeMigration({ addressBook: {} })
    const wrongVersion = '#v2' + encoded.slice(encoded.indexOf('.'))

    await expect(decodeMigrationFragment(wrongVersion)).rejects.toMatchObject({ reason: 'unsupported-version' })
  })

  it('rejects a fragment missing the base64 segment', async () => {
    await expect(decodeMigrationFragment('#v1')).rejects.toMatchObject({ reason: 'unsupported-version' })
  })

  it('rejects malformed base64', async () => {
    await expect(decodeMigrationFragment('#v1.not-valid-gzip-base64!!!')).rejects.toMatchObject({
      reason: 'malformed',
    })
  })

  it('rejects a payload that decompresses to non-JSON', async () => {
    const bytes = new TextEncoder().encode('not json')
    const gz = await new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer()
    const b64url = btoa(String.fromCharCode(...new Uint8Array(gz)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')

    await expect(decodeMigrationFragment(`#v1.${b64url}`)).rejects.toBeInstanceOf(MigrationDecodeFailure)
  })

  it('rejects a payload exceeding the max encoded length', async () => {
    const huge = 'a'.repeat(1_000_001)

    await expect(decodeMigrationFragment(`#v1.${huge}`)).rejects.toMatchObject({ reason: 'malformed' })
  })
})
