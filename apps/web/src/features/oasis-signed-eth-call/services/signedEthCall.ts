import { BrowserProvider, getBytes, hexlify, type Eip1193Provider, type JsonRpcProvider } from 'ethers'
import { KeyFetcher, type EIP2696_EthereumProvider } from '@oasisprotocol/sapphire-paratime'
import { encode as cborEncode, decode as cborDecode } from 'cborg'

type Cipher = ReturnType<InstanceType<typeof KeyFetcher>['cipherSync']>

export type SignedCallParams = {
  from: string
  to: string
  data: string
  gasLimit?: bigint
  value?: bigint
}

type SignedCall = { signedData: string; cipher: Cipher }

type CachedSignedCall = SignedCall & { leashBlock: number }

type Leash = { leashBlockNumber: number; leashBlockHash: string; senderNonce: number }

// Oasis derives msg.sender from an EIP-712 signature over the call; the node rejects replays outside the leash window
const SIGNED_QUERY_DOMAIN_NAME = 'oasis-runtime-sdk/evm: signed query'
const SIGNED_QUERY_DOMAIN_VERSION = '1.0.0'
const DEFAULT_GAS_PRICE = 100_000_000_000n
const DEFAULT_GAS_LIMIT = 30_000_000n
const DEFAULT_BLOCK_RANGE = 15

const CALL_EIP712_TYPES = {
  Call: [
    { name: 'from', type: 'address' },
    { name: 'to', type: 'address' },
    { name: 'gasLimit', type: 'uint64' },
    { name: 'gasPrice', type: 'uint256' },
    { name: 'value', type: 'uint256' },
    { name: 'data', type: 'bytes' },
    { name: 'leash', type: 'Leash' },
  ],
  Leash: [
    { name: 'nonce', type: 'uint64' },
    { name: 'blockNumber', type: 'uint64' },
    { name: 'blockHash', type: 'bytes32' },
    { name: 'blockRange', type: 'uint64' },
  ],
}

// Keyed by everything that is signed (chain, `from`, `to`, `data`, `gasLimit`, `value`), so a changed call is re-signed
const signedCallCache = new Map<string, CachedSignedCall>()

// Deduplicates concurrent builds so a React re-render does not open a second signing prompt
const inFlightBuilds = new Map<string, Promise<SignedCall>>()

const getCacheKey = (params: SignedCallParams, chainId: number): string =>
  [chainId, params.from, params.to, params.data, params.gasLimit ?? DEFAULT_GAS_LIMIT, params.value ?? 0n].join(':')

const toEip1193Reader = (readOnlyProvider: JsonRpcProvider): EIP2696_EthereumProvider => ({
  request: ({ method, params = [] }: { method: string; params?: unknown }) =>
    readOnlyProvider.send(method, (params as unknown[]) ?? []),
})

const isLeashValid = (cached: CachedSignedCall, currentBlock: number): boolean =>
  currentBlock <= cached.leashBlock + DEFAULT_BLOCK_RANGE - 1

/**
 * True when a signed call's envelope carries a Safe revert that the node reports as a plain JSON-RPC error.
 * ethers v6 nests the raw RPC code at error.error.code or error.info.error.code.
 */
export const isJsonRpcRevert = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') return false
  const rpcCode =
    (error as { error?: { code?: number } }).error?.code ??
    (error as { info?: { error?: { code?: number } } }).info?.error?.code
  return rpcCode === 3
}

/**
 * True when the decrypted envelope reports a failure, i.e. the Safe contract reverted inside the encrypted call.
 * Format errors (e.g. an unencrypted envelope) are not failures and return false.
 */
export const isSapphireEnvelopeFailure = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') return false

  const { response } = error as { response?: unknown }
  if (response && typeof response === 'object' && 'module' in response && 'code' in response) {
    return true
  }

  const { code } = error as { code?: string }
  return code === 'CALL_EXCEPTION'
}

const fetchCipher = async (readOnlyProvider: JsonRpcProvider): Promise<Cipher> => {
  const fetcher = new KeyFetcher()
  await fetcher.fetch(toEip1193Reader(readOnlyProvider))
  return fetcher.cipherSync()
}

// Leash is anchored one block behind the head, so the signed call stays valid for DEFAULT_BLOCK_RANGE blocks
const buildLeash = async (readOnlyProvider: JsonRpcProvider, from: string, currentBlock: number): Promise<Leash> => {
  const leashBlockNumber = currentBlock - 1
  const leashBlock = await readOnlyProvider.getBlock(leashBlockNumber)
  if (!leashBlock?.hash) throw new Error('Could not fetch leash block')

  const senderNonce = await readOnlyProvider.getTransactionCount(from)

  return { leashBlockNumber, leashBlockHash: leashBlock.hash, senderNonce }
}

const signCall = async (
  walletProvider: BrowserProvider,
  domain: { name: string; version: string; chainId: number },
  params: SignedCallParams,
  leash: Leash,
): Promise<string> => {
  const signer = await walletProvider.getSigner()
  return signer.signTypedData(domain, CALL_EIP712_TYPES, {
    from: params.from,
    to: params.to,
    gasLimit: params.gasLimit ?? DEFAULT_GAS_LIMIT,
    gasPrice: DEFAULT_GAS_PRICE,
    value: params.value ?? 0n,
    // Sign the plaintext calldata; the encrypted form is only sent to the node
    data: getBytes(params.data),
    leash: {
      nonce: BigInt(leash.senderNonce),
      blockNumber: BigInt(leash.leashBlockNumber),
      blockHash: leash.leashBlockHash as `0x${string}`,
      blockRange: BigInt(DEFAULT_BLOCK_RANGE),
    },
  })
}

const createSignedCallPayload = (encryptedEnvelope: unknown, leash: Leash, signature: string): string =>
  hexlify(
    cborEncode({
      data: encryptedEnvelope,
      leash: {
        nonce: leash.senderNonce,
        block_number: leash.leashBlockNumber,
        block_hash: getBytes(leash.leashBlockHash),
        block_range: DEFAULT_BLOCK_RANGE,
      },
      signature: getBytes(signature),
    }),
  )

const buildSignedCall = async (
  readOnlyProvider: JsonRpcProvider,
  walletProvider: BrowserProvider,
  params: SignedCallParams,
  chainId: number,
  currentBlock: number,
): Promise<CachedSignedCall> => {
  const cipher = await fetchCipher(readOnlyProvider)
  const encryptedEnvelope = cborDecode(getBytes(cipher.encryptCall(params.data)))

  const leash = await buildLeash(readOnlyProvider, params.from, currentBlock)

  const domain = { name: SIGNED_QUERY_DOMAIN_NAME, version: SIGNED_QUERY_DOMAIN_VERSION, chainId }
  const signature = await signCall(walletProvider, domain, params, leash)

  return {
    signedData: createSignedCallPayload(encryptedEnvelope, leash, signature),
    cipher,
    leashBlock: leash.leashBlockNumber,
  }
}

/**
 * Builds the encrypted, signed `eth_call` payload. Prompts the wallet to sign once per leash window (~90 s on mainnet).
 */
const getOrBuildSignedCall = async (
  readOnlyProvider: JsonRpcProvider,
  walletProvider: BrowserProvider,
  params: SignedCallParams,
  chainId: number,
): Promise<SignedCall> => {
  const cacheKey = getCacheKey(params, chainId)
  const currentBlock = await readOnlyProvider.getBlockNumber()

  const cached = signedCallCache.get(cacheKey)
  if (cached && isLeashValid(cached, currentBlock)) return cached

  const inFlight = inFlightBuilds.get(cacheKey)
  if (inFlight) return inFlight

  const build = buildSignedCall(readOnlyProvider, walletProvider, params, chainId, currentBlock)
    .then((built) => {
      signedCallCache.set(cacheKey, built)
      return built
    })
    .finally(() => inFlightBuilds.delete(cacheKey))

  inFlightBuilds.set(cacheKey, build)
  return build
}

/**
 * Runs a signed `eth_call` so that msg.sender = params.from on Oasis Sapphire. Unsigned calls always see
 * msg.sender = 0x0 there, which hides reverts. Throws on genuine Safe reverts and on a dismissed signing prompt;
 * other RPC failures are treated as "validation unavailable" and resolve silently.
 */
export const validateOasisSignedCall = async (
  readOnlyProvider: JsonRpcProvider,
  eip1193Provider: Eip1193Provider,
  params: SignedCallParams,
  chainId: number,
): Promise<void> => {
  const walletProvider = new BrowserProvider(eip1193Provider)
  const { signedData, cipher } = await getOrBuildSignedCall(readOnlyProvider, walletProvider, params, chainId)

  // gas and gasPrice must match the values signed in the EIP-712 message
  const gasLimit = params.gasLimit ?? DEFAULT_GAS_LIMIT

  let rawResult: string
  try {
    rawResult = (await readOnlyProvider.send('eth_call', [
      {
        to: params.to,
        from: params.from,
        data: signedData,
        gas: `0x${gasLimit.toString(16)}`,
        gasPrice: `0x${DEFAULT_GAS_PRICE.toString(16)}`,
      },
      'latest',
    ])) as string
  } catch (error) {
    if (isJsonRpcRevert(error)) throw error
    return
  }

  try {
    cipher.decryptResult(rawResult)
  } catch (error) {
    if (isSapphireEnvelopeFailure(error)) throw error
  }
}
