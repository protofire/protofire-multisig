export type MigrationPayload = {
  addressBook?: unknown
  addedSafes?: unknown
  settings?: unknown
  safeApps?: unknown
  undeployedSafes?: unknown
  visitedSafes?: unknown
}

export type MigrationDecodeFailureReason = 'no-fragment' | 'unsupported-version' | 'malformed'

export class MigrationDecodeFailure extends Error {
  public readonly reason: MigrationDecodeFailureReason

  constructor(reason: MigrationDecodeFailureReason) {
    super(`Failed to decode migration fragment: ${reason}`)
    this.reason = reason
  }
}

const MIGRATION_FRAGMENT_VERSION = 'v1'

// Generous ceiling on the encoded fragment itself, well under any browser's URL length
// limit - guards against a pathological payload rather than a realistic one.
export const MAX_ENCODED_FRAGMENT_LENGTH = 1_000_000

const base64UrlToBase64 = (b64url: string): string => {
  const base64 = b64url.replace(/-/g, '+').replace(/_/g, '/')
  return base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')
}

/**
 * Decodes the `#v1.<base64url-gzip-json>` URL fragment produced by the sending app's
 * `encodeMigration` (see the counterpart in the whitelabel/source deployment). Replaces
 * the old iframe + postMessage handshake: fragments are never sent to the server and are
 * readable regardless of which origin set them, so no cross-origin bridge page is needed.
 */
export const decodeMigrationFragment = async (hash: string): Promise<MigrationPayload> => {
  const raw = hash.replace(/^#/, '')
  if (!raw) {
    throw new MigrationDecodeFailure('no-fragment')
  }

  const [version, b64url] = raw.split('.')
  if (version !== MIGRATION_FRAGMENT_VERSION || !b64url) {
    throw new MigrationDecodeFailure('unsupported-version')
  }

  if (b64url.length > MAX_ENCODED_FRAGMENT_LENGTH) {
    throw new MigrationDecodeFailure('malformed')
  }

  let parsed: unknown
  try {
    const gz = Uint8Array.from(atob(base64UrlToBase64(b64url)), (c) => c.charCodeAt(0))
    const json = await new Response(new Blob([gz]).stream().pipeThrough(new DecompressionStream('gzip'))).text()
    parsed = JSON.parse(json)
  } catch {
    throw new MigrationDecodeFailure('malformed')
  }

  if (typeof parsed !== 'object' || parsed === null) {
    throw new MigrationDecodeFailure('malformed')
  }

  return parsed as MigrationPayload
}
