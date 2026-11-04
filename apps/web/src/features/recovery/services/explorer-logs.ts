import type { Chain } from '@safe-global/store/gateway/AUTO_GENERATED/chains'
import { ETHERSCAN_API_KEY } from '@/config/constants'

export const EXPLORER_FETCH_TIMEOUT_MS = 15_000

/** An Etherscan-compatible `module`/`action` API, as both Etherscan and Blockscout serve it */
export type ExplorerApi = {
  url: string
  params: Record<string, string>
}

/** A log as the `logs`/`getLogs` action returns it, with numbers as hex strings */
export type ExplorerLog = {
  address: string
  topics: Array<string | null>
  data: string
  blockNumber: string
  blockHash?: string
  logIndex: string
  transactionHash: string
  transactionIndex: string
}

const parseUrl = (url: string): URL | null => {
  try {
    return new URL(url)
  } catch {
    return null
  }
}

/**
 * The explorer API of a chain, from the `api` template of its config. Parameters the template fixes,
 * like the `chainid` of the Etherscan API V2, are kept, and `{{chainId}}` and `{{apiKey}}` are filled in.
 * Null when the chain has no Etherscan-compatible API, e.g. only Blockscout's REST API.
 */
export const getExplorerApi = (
  chain: Pick<Chain, 'chainId' | 'blockExplorerUriTemplate'> | undefined,
  apiKey = ETHERSCAN_API_KEY,
): ExplorerApi | null => {
  const template = chain?.blockExplorerUriTemplate?.api
  if (!chain || !template?.includes('{{module}}')) {
    return null
  }

  // `{{module}}`, `{{action}}` and `{{address}}` are set per request
  const placeholders: Record<string, string> = {
    '{{chainId}}': chain.chainId,
    '{{apiKey}}': apiKey,
  }

  const url = parseUrl(template)
  if (!url) {
    return null
  }

  const params: Record<string, string> = {}
  url.searchParams.forEach((value, name) => {
    const filled = value.startsWith('{{') ? placeholders[value] : value
    if (filled) {
      params[name] = filled
    }
  })

  return { url: `${url.origin}${url.pathname}`, params }
}

const getTopicParams = (topics: Array<string>): Record<string, string> => {
  const params: Record<string, string> = {}

  topics.forEach((topic, index) => {
    params[`topic${index}`] = topic
    // Etherscan and Blockscout require an operator between every pair of topics
    for (let previous = 0; previous < index; previous++) {
      params[`topic${previous}_${index}_opr`] = 'and'
    }
  })

  return params
}

/** Logs of a contract matching all `topics`, from its whole history */
export const getExplorerLogs = async (
  explorer: ExplorerApi,
  { address, topics }: { address: string; topics: Array<string> },
): Promise<Array<ExplorerLog>> => {
  const params = new URLSearchParams({
    ...explorer.params,
    module: 'logs',
    action: 'getLogs',
    address,
    fromBlock: '0',
    toBlock: 'latest',
    ...getTopicParams(topics),
  })

  const response = await fetch(`${explorer.url}?${params}`, { signal: AbortSignal.timeout(EXPLORER_FETCH_TIMEOUT_MS) })
  if (!response.ok) {
    throw new Error(`Block explorer responded with ${response.status}`)
  }

  const { result } = (await response.json()) as { result?: unknown }
  // An error comes as a message in place of the logs. No logs found is an empty array
  if (!Array.isArray(result)) {
    throw new Error(`Block explorer error: ${String(result)}`)
  }

  return result as Array<ExplorerLog>
}
