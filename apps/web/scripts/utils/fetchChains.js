/**
 * Shared build-time helper to read the full chain list from the CGW.
 *
 * The gateway caps `/v1/chains` at 40 results per page regardless of the requested
 * limit and exposes the rest through the `next` cursor. Requesting a single page
 * silently drops every chain past the first one, so the cursor must be followed.
 */

const PAGE_LIMIT = 40
const MAX_PAGES = 100

/**
 * @param {string} gatewayURL
 * @param {typeof fetch} [fetchImpl]
 * @returns {Promise<unknown[]>}
 */
export async function fetchAllChains(gatewayURL, fetchImpl = fetch) {
  const results = []
  let url = `${gatewayURL}/v1/chains?cursor=limit%3D${PAGE_LIMIT}%26offset%3D0`
  let pages = 0

  while (url) {
    if (++pages > MAX_PAGES) {
      throw new Error(`Aborting after ${MAX_PAGES} pages of /v1/chains — the gateway cursor is not terminating`)
    }

    const response = await fetchImpl(url)

    if (!response.ok) {
      throw new Error(`Failed to fetch chains from ${url}: ${response.status} ${response.statusText}`)
    }

    const page = await response.json()
    results.push(...page.results)
    url = page.next ?? null
  }

  return results
}
