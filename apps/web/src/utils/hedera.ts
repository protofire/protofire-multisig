import type { Chain } from '@safe-global/store/gateway/AUTO_GENERATED/chains'
import type { TransactionDetails } from '@safe-global/store/gateway/AUTO_GENERATED/transactions'
import { FEATURES, getBlockExplorerLink, hasFeature } from '@safe-global/utils/utils/chains'
import { HEDERA_MIRROR_NODE_MAINNET_URL, HEDERA_MIRROR_NODE_TESTNET_URL } from '@/config/constants'

/** Values double as the network path segment of mirror node / HashScan URLs and as `LedgerId` names. */
export enum HederaNetwork {
  MAINNET = 'mainnet',
  TESTNET = 'testnet',
}

const MIRROR_NODE_BASE_URL: Record<HederaNetwork, string> = {
  [HederaNetwork.MAINNET]: HEDERA_MIRROR_NODE_MAINNET_URL,
  [HederaNetwork.TESTNET]: HEDERA_MIRROR_NODE_TESTNET_URL,
}

export const isHederaChain = (chain: Chain | undefined): chain is Chain => !!chain && hasFeature(chain, FEATURES.HEDERA)

/** The Hedera network a chain config points at, or undefined for any non-Hedera (or not yet loaded) chain. */
export const getHederaNetwork = (chain: Chain | undefined): HederaNetwork | undefined => {
  if (!isHederaChain(chain)) return undefined
  return chain.isTestnet ? HederaNetwork.TESTNET : HederaNetwork.MAINNET
}

/** CGW additionally reports the native transaction id of a Hedera transfer that never went through the EVM relay */
export type HederaTransactionDetails = TransactionDetails & { hederaTransactionId?: string }

/** The Hedera Token Service (HTS) system contract, at native entity id `0.0.359`. */
export const HTS_PRECOMPILE_ADDRESS = '0x0000000000000000000000000000000000000167'

// HashPack/HashScan always display accounts with their HIP-15 checksum suffix (e.g.
// "0.0.123-vfmkw") — accept it here too, or copy-pasting a native id straight from either always
// fails as "invalid format".
const HEDERA_ENTITY_ID_REGEX = /^0\.0\.\d+(-[a-z]{5})?$/

/** Matches a native Hedera entity id (`shard.realm.num`, shard/realm always 0 in practice, with
 * an optional HIP-15 checksum suffix) — the same shape for accounts, contracts, and tokens. */
export const isHederaAccountId = (value: string): boolean => HEDERA_ENTITY_ID_REGEX.test(value.trim())

/**
 * Strips a HIP-15 checksum suffix (e.g. "0.0.123-vfmkw" -> "0.0.123") from a Hedera entity id, if
 * present. Safe to call on a 0x address too — it never contains a hyphen, so this is a no-op for
 * one. Only strips the suffix; it does not validate the checksum itself (that needs HIP-15's own
 * ledger-specific algorithm), so a wrong-network checksum won't be caught here.
 */
const stripHederaChecksum = (idOrAddress: string): string => idOrAddress.trim().split('-')[0]

/**
 * Converts a native Hedera entity id (`0.0.X`, with or without a HIP-15 checksum suffix) into its
 * deterministic "long-zero" EVM address — pure/offline, no network call. Valid for entities with
 * no real EVM alias: HTS tokens always take this form (mirror node's token schema has no
 * `evm_address` field at all), and it's also the fallback form for accounts/contracts that
 * haven't been given a real ECDSA-derived alias.
 */
export const hederaEntityIdToEvmAddress = (entityId: string): string => {
  const num = stripHederaChecksum(entityId).split('.').at(-1) ?? '0'
  return `0x${BigInt(num).toString(16).padStart(40, '0')}`
}

const LONG_ZERO_ADDRESS_REGEX = /^0x0{24}[0-9a-f]{16}$/i

/**
 * Whether a 0x address is a "long-zero" address (see `hederaEntityIdToEvmAddress`) rather than one
 * derived from an ECDSA key. No key ever recovers to it via `ecrecover`, so it can't produce an
 * EVM signature — ED25519 accounts and ECDSA accounts without an EVM alias both take this form.
 */
export const isHederaLongZeroAddress = (address: string): boolean => LONG_ZERO_ADDRESS_REGEX.test(address)

/**
 * HashScan's native-account explorer URL — distinct from the chain config's own
 * `blockExplorerUriTemplate`, which only covers 0x address/tx-hash patterns, not `0.0.X` ids.
 */
export const getHederaAccountExplorerLink = (network: HederaNetwork, accountId: string): string =>
  `https://hashscan.io/${network}/account/${accountId}`

/**
 * HashScan's native-token explorer URL — HTS tokens are served at a distinct `/token/` path, not
 * `/account/` (the chain config's generic `blockExplorerUriTemplate`, and `getHederaAccountExplorerLink`
 * above, both point at the account path — wrong for a token's own EVM address).
 */
export const getHederaTokenExplorerLink = (network: HederaNetwork, evmAddress: string): string =>
  `https://hashscan.io/${network}/token/${evmAddress}`

/**
 * Explorer link for a token contract address: HashScan's `/token/` page on Hedera, where the chain
 * config's address template points at `/account/`; the generic block-explorer link elsewhere.
 */
export const getTokenExplorerLink = (
  chain: Chain,
  tokenAddress: string,
): { href: string; title: string } | undefined => {
  const network = getHederaNetwork(chain)
  if (!network) return getBlockExplorerLink(chain, tokenAddress)

  const href = getHederaTokenExplorerLink(network, tokenAddress)
  return { href, title: `View on ${new URL(href).hostname}` }
}

/**
 * HashScan's native-transaction explorer URL, keyed by the real Hedera transaction id in the mirror
 * node's format (`shard.realm.num-seconds-nanos`). Native transfers (e.g. HBAR sent from HashPack)
 * never went through the EVM relay, so the `txHash` the backend reports for them is a placeholder
 * that the chain config's `blockExplorerUriTemplate` can't resolve.
 */
export const getHederaTransactionExplorerLink = (network: HederaNetwork, transactionId: string): string =>
  `https://hashscan.io/${network}/transaction/${transactionId}`

/**
 * Formats a mirror-node transaction id (`shard.realm.num-seconds-nanos`) the way HashPack and
 * HashScan display it (`shard.realm.num@seconds.nanos`). Returns any other input unchanged.
 */
export const formatHederaTransactionId = (transactionId: string): string => {
  const match = transactionId.match(/^(\d+\.\d+\.\d+)-(\d+)-(\d+)$/)
  return match ? `${match[1]}@${match[2]}.${match[3]}` : transactionId
}

interface MirrorNodeAccount {
  account?: string
  evm_address?: string
}

const MIRROR_FETCH_TIMEOUT_MS = 10_000

const fetchMirrorNodeAccount = async (network: HederaNetwork, idOrAddress: string): Promise<MirrorNodeAccount> => {
  const response = await fetch(`${MIRROR_NODE_BASE_URL[network]}/api/v1/accounts/${stripHederaChecksum(idOrAddress)}`, {
    signal: AbortSignal.timeout(MIRROR_FETCH_TIMEOUT_MS),
  })
  if (!response.ok) {
    throw new Error(`Failed to resolve Hedera account ${idOrAddress}: mirror node returned ${response.status}`)
  }
  const data = (await response.json()) as MirrorNodeAccount
  // Some mirror node responses omit the 0x prefix on evm_address — normalize it so every caller
  // downstream can rely on a real `0x${string}`.
  return data.evm_address && !data.evm_address.startsWith('0x')
    ? { ...data, evm_address: `0x${data.evm_address}` }
    : data
}

const evmAddressCache = new Map<string, string>()

/**
 * Resolves the stable 0x EVM-alias address for a Hedera account (given its native `0.0.X` id)
 * via the public mirror-node REST API. This works for both ECDSA accounts (a real derived
 * alias) and ED25519/no-alias accounts (a deterministic "long-zero" address Hedera synthesizes
 * from the account number) — Safe just needs a stable per-owner 0x identifier, not a "real"
 * EVM key.
 */
export const getHederaEvmAddress = async (network: HederaNetwork, accountId: string): Promise<string> => {
  const cacheKey = `${network}:${accountId}`
  const cached = evmAddressCache.get(cacheKey)
  if (cached) return cached

  const data = await fetchMirrorNodeAccount(network, accountId)
  if (!data.evm_address) {
    throw new Error(`Hedera account ${accountId} has no evm_address`)
  }

  evmAddressCache.set(cacheKey, data.evm_address)
  return data.evm_address
}

const accountIdCache = new Map<string, string>()

/**
 * Resolves the native Hedera account id (`0.0.X`) for a given 0x EVM-alias address, via the
 * public mirror-node REST API (which accepts either form as the lookup key) — the reverse of
 * `getHederaEvmAddress`. Used to show a Hedera owner's native account id alongside their 0x
 * address, the same way Tron shows a base58 address alongside its 0x form (see `utils/tron.ts`).
 */
export const getHederaAccountId = async (network: HederaNetwork, evmAddress: string): Promise<string> => {
  const cacheKey = `${network}:${evmAddress}`
  const cached = accountIdCache.get(cacheKey)
  if (cached) return cached

  const data = await fetchMirrorNodeAccount(network, evmAddress)
  if (!data.account) {
    throw new Error(`No Hedera account found for ${evmAddress}`)
  }

  accountIdCache.set(cacheKey, data.account)
  return data.account
}

const contractIdCache = new Map<string, string>()

/**
 * Resolves the native Hedera contract id (`0.0.X`) for a given 0x EVM address, via the public
 * mirror-node REST API. Every EVM contract on Hedera has one — use this instead of
 * `ContractId.fromEvmAddress()` when building a `ContractExecuteTransaction`: the SDK's
 * `evmAddress`-based `ContractId` relies on a protobuf `oneof` alongside `contractNum` that
 * doesn't reliably survive a serialize → WalletConnect → deserialize round trip (observed: the
 * wallet ends up signing a transaction targeting contract `0.0.0` instead of the intended
 * contract). A plain `contractNum`-based id has no such ambiguity.
 */
export const getHederaContractId = async (network: HederaNetwork, evmAddress: string): Promise<string> => {
  const cacheKey = `${network}:${evmAddress}`
  const cached = contractIdCache.get(cacheKey)
  if (cached) return cached

  const response = await fetch(`${MIRROR_NODE_BASE_URL[network]}/api/v1/contracts/${evmAddress}`, {
    signal: AbortSignal.timeout(MIRROR_FETCH_TIMEOUT_MS),
  })
  if (!response.ok) {
    throw new Error(`Failed to resolve Hedera contract ${evmAddress}: mirror node returned ${response.status}`)
  }
  const data = (await response.json()) as { contract_id?: string }
  if (!data.contract_id) {
    throw new Error(`No Hedera contract found for ${evmAddress}`)
  }

  contractIdCache.set(cacheKey, data.contract_id)
  return data.contract_id
}

/**
 * Converts a Hedera SDK `TransactionId` string (`shard.realm.num@seconds.nanos`) into the
 * mirror node's own transaction-id format (`shard.realm.num-seconds-nanos`).
 */
const toMirrorNodeTransactionId = (transactionId: string): string => {
  const [entityId, validStart] = transactionId.split('@')
  const [seconds, nanos] = validStart.split('.')
  return `${entityId}-${seconds}-${nanos}`
}

const TRANSACTION_RECEIPT_POLL_ATTEMPTS = 20
const TRANSACTION_RECEIPT_POLL_INITIAL_MS = 1000
const TRANSACTION_RECEIPT_POLL_MAX_MS = 5000

/**
 * Resolves the real EVM-equivalent transaction hash for a Hedera transaction, by polling the
 * mirror node's contract-results endpoint until the record is indexed. A native Hedera
 * transaction's own hash (`TransactionResponse.transactionHash`, a SHA-384 digest) is a
 * different value entirely from the keccak-based hash the EVM JSON-RPC world expects back from
 * `eth_sendTransaction` — callers (e.g. ethers' `BrowserProvider` polling `eth_getTransactionByHash`
 * to confirm a deployment) need this one, not the native one.
 *
 * Backs off up to TRANSACTION_RECEIPT_POLL_MAX_MS between attempts (~90s total with the default
 * `maxAttempts`) rather than a fixed short interval: consensus for the underlying transaction has
 * normally already been reached by the time this is called (dAppConnector.signAndExecuteTransaction
 * already awaited it) — only mirror node *indexing* lag remains, which can occasionally exceed a
 * few seconds under load. `maxAttempts` is overridable for the one caller (hashpack-module) that
 * starts this *before* consensus is reached at all, watching for a transaction id it generated
 * itself, racing it against a WalletConnect round trip that can take much longer to settle — and
 * which aborts it via `signal` once that race is decided, rather than leaving it polling.
 */
export const getHederaEvmTransactionHash = async (
  network: HederaNetwork,
  transactionId: string,
  maxAttempts: number = TRANSACTION_RECEIPT_POLL_ATTEMPTS,
  signal?: AbortSignal,
): Promise<string> => {
  const mirrorNodeTransactionId = toMirrorNodeTransactionId(transactionId)

  let delay = TRANSACTION_RECEIPT_POLL_INITIAL_MS
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    signal?.throwIfAborted()
    const response = await fetch(
      `${MIRROR_NODE_BASE_URL[network]}/api/v1/contracts/results/${mirrorNodeTransactionId}`,
      { signal: AbortSignal.timeout(MIRROR_FETCH_TIMEOUT_MS) },
    ).catch(() => undefined)
    if (response?.ok) {
      const data = (await response.json()) as { hash?: string }
      if (data.hash) return data.hash
    }
    await new Promise((resolve) => setTimeout(resolve, delay))
    delay = Math.min(delay * 1.5, TRANSACTION_RECEIPT_POLL_MAX_MS)
  }

  // The Hedera transaction itself already reached consensus by this point (see above) — only
  // the mirror-node-indexed EVM hash lookup timed out, so the transaction most likely succeeded
  // even though this specific lookup couldn't confirm it.
  throw new Error(
    `Hedera transaction ${transactionId} was submitted but its EVM-equivalent hash could not be confirmed ` +
      `(mirror node indexing is taking longer than usual) — check HashScan for the transaction's real status ` +
      `before retrying.`,
  )
}

export type HederaTokenType = 'FUNGIBLE_COMMON' | 'NON_FUNGIBLE_UNIQUE'

export interface HederaTokenMetadata {
  tokenId: string
  evmAddress: string
  name: string
  symbol: string
  decimals: number
  type: HederaTokenType
  deleted: boolean
}

export type HederaFreezeStatus = 'NOT_APPLICABLE' | 'FROZEN' | 'UNFROZEN'

export interface HederaAssociatedToken {
  tokenId: string
  evmAddress: string
  name: string
  symbol: string
  /** Raw amount in the token's smallest unit — divide by `10 ** decimals` to display */
  balance: number
  decimals: number
  freezeStatus: HederaFreezeStatus
  createdAt: Date
}

interface MirrorNodeAccountToken {
  token_id: string
  balance: number
  decimals: number
  freeze_status: HederaFreezeStatus
  created_timestamp: string
}

interface MirrorNodeTokenSummary {
  token_id: string
  name: string
  symbol: string
}

// Mirror node's max page size — the table paginates client-side, so fetch in as few round trips as possible
const MIRROR_NODE_PAGE_SIZE = 100
const MIRROR_NODE_MAX_PAGES = 10

interface MirrorNodePagedResult<T> {
  items: T[]
  /** More pages were available after MIRROR_NODE_MAX_PAGES — `items` is partial */
  truncated: boolean
}

/** Collects a mirror node list endpoint's `key` array across its `links.next` pages, bounded. */
const fetchMirrorNodePages = async <Key extends string, T>(
  network: HederaNetwork,
  firstPath: string,
  key: Key,
): Promise<MirrorNodePagedResult<T>> => {
  const items: T[] = []
  let path: string | null = firstPath
  let page = 0

  for (; page < MIRROR_NODE_MAX_PAGES && path; page++) {
    const response = await fetch(`${MIRROR_NODE_BASE_URL[network]}${path}`, {
      signal: AbortSignal.timeout(MIRROR_FETCH_TIMEOUT_MS),
    })
    if (!response.ok) {
      throw new Error(`Mirror node request ${path} failed with status ${response.status}`)
    }
    const data = (await response.json()) as Partial<Record<Key, T[]>> & { links?: { next?: string | null } }
    items.push(...(data[key] ?? []))
    path = data.links?.next ?? null
  }

  return { items, truncated: page >= MIRROR_NODE_MAX_PAGES && path !== null }
}

/**
 * The mirror node's `account.id`/`token.id` query filters only match native `0.0.X` ids — an EVM
 * address there silently returns an empty list rather than an error.
 */
const toHederaNativeAccountId = (network: HederaNetwork, accountIdOrEvmAddress: string): Promise<string> =>
  isHederaAccountId(accountIdOrEvmAddress)
    ? Promise.resolve(stripHederaChecksum(accountIdOrEvmAddress))
    : getHederaAccountId(network, accountIdOrEvmAddress)

export interface HederaAssociatedTokensResult {
  tokens: HederaAssociatedToken[]
  /** True if the account has more associated tokens than MIRROR_NODE_MAX_PAGES worth of pages
   * could return — `tokens` is a partial, not the complete list. */
  truncated: boolean
}

/**
 * Lists every HTS token associated with an account (given its native id or 0x/EVM address) for the
 * Settings "Token association" table. Balances come from `/accounts/{id}/tokens`, which has no
 * token names — those come from `/tokens?account.id=`, one paginated request instead of one
 * `/tokens/{id}` lookup per row. Callers must check `truncated` rather than assume a short list
 * is necessarily complete.
 */
export const getHederaAssociatedTokens = async (
  network: HederaNetwork,
  accountIdOrEvmAddress: string,
): Promise<HederaAssociatedTokensResult> => {
  const accountId = await toHederaNativeAccountId(network, accountIdOrEvmAddress)

  const [relationships, summaries] = await Promise.all([
    fetchMirrorNodePages<'tokens', MirrorNodeAccountToken>(
      network,
      `/api/v1/accounts/${accountId}/tokens?limit=${MIRROR_NODE_PAGE_SIZE}`,
      'tokens',
    ),
    fetchMirrorNodePages<'tokens', MirrorNodeTokenSummary>(
      network,
      `/api/v1/tokens?account.id=${accountId}&limit=${MIRROR_NODE_PAGE_SIZE}`,
      'tokens',
    ),
  ])

  const summaryById = new Map(summaries.items.map((summary) => [summary.token_id, summary]))

  return {
    tokens: relationships.items.map((token) => ({
      tokenId: token.token_id,
      evmAddress: hederaEntityIdToEvmAddress(token.token_id),
      name: summaryById.get(token.token_id)?.name ?? '',
      symbol: summaryById.get(token.token_id)?.symbol ?? '',
      balance: token.balance,
      decimals: token.decimals,
      freezeStatus: token.freeze_status,
      createdAt: new Date(Number(token.created_timestamp.split('.')[0]) * 1000),
    })),
    truncated: relationships.truncated,
  }
}

/**
 * Whether a single HTS token is already associated with an account — the mirror node's `token.id`
 * filter returns just that one relationship (or none), instead of listing every association.
 */
export const isHederaTokenAssociated = async (
  network: HederaNetwork,
  accountIdOrEvmAddress: string,
  tokenId: string,
): Promise<boolean> => {
  const accountId = await toHederaNativeAccountId(network, accountIdOrEvmAddress)
  const { items } = await fetchMirrorNodePages<'tokens', MirrorNodeAccountToken>(
    network,
    `/api/v1/accounts/${accountId}/tokens?token.id=${stripHederaChecksum(tokenId)}`,
    'tokens',
  )
  return items.length > 0
}

/**
 * Resolves an HTS token's metadata given either its native id (`0.0.X`) or its (long-zero) 0x
 * address — the mirror node's `/tokens` endpoint accepts either form directly. Used both to show
 * a "selected token to associate" confirmation card, and to validate the user's input actually
 * names a real, non-deleted token before letting them proceed.
 */
export const getHederaTokenMetadata = async (
  network: HederaNetwork,
  idOrEvmAddress: string,
): Promise<HederaTokenMetadata> => {
  const response = await fetch(
    `${MIRROR_NODE_BASE_URL[network]}/api/v1/tokens/${stripHederaChecksum(idOrEvmAddress)}`,
    {
      signal: AbortSignal.timeout(MIRROR_FETCH_TIMEOUT_MS),
    },
  )
  if (!response.ok) {
    throw new Error(`Failed to resolve Hedera token ${idOrEvmAddress}: mirror node returned ${response.status}`)
  }
  const data = (await response.json()) as {
    token_id?: string
    name?: string
    symbol?: string
    decimals?: string
    type?: HederaTokenType
    deleted?: boolean
  }
  if (!data.token_id) {
    throw new Error(`No Hedera token found for ${idOrEvmAddress}`)
  }

  return {
    tokenId: data.token_id,
    evmAddress: hederaEntityIdToEvmAddress(data.token_id),
    name: data.name ?? '',
    symbol: data.symbol ?? '',
    decimals: Number(data.decimals ?? 0),
    type: data.type ?? 'FUNGIBLE_COMMON',
    deleted: data.deleted ?? false,
  }
}
