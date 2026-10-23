import type { WalletInit } from '@web3-onboard/common'
import { createEIP1193Provider } from '@web3-onboard/common'
import type { Chain } from '@safe-global/store/gateway/AUTO_GENERATED/chains'
import type { SessionTypes } from '@walletconnect/types'
import { WC_PROJECT_ID, BRAND_NAME } from '@/config/constants'
import { numberToHex } from '@/utils/hex'
import { getRpcServiceUrl } from '@/hooks/wallets/web3'
import {
  getHederaEvmAddress,
  getHederaContractId,
  getHederaEvmTransactionHash,
  getHederaNetwork,
  type HederaNetwork,
} from '@/utils/hedera'
import type { TransactionResponseJSON } from '@hiero-ledger/sdk'
import type { DAppConnector } from '@hashgraph/hedera-wallet-connect'

export const HASHPACK_MODULE_LABEL = 'HashPack'

// One per ledger for the page's lifetime. Every DAppConnector shares WalletConnect's global Core, and
// each one's SignClient unsubscribes (on every heartbeat) the relay topics missing from its own session
// store — a second connector, e.g. after switching the HashPack account, drops the session's
// subscription, so HashPack's replies (e.g. rejection) never arrive.
const dAppConnectors = new Map<HederaNetwork, Promise<DAppConnector>>()

// Above onboard's own modal (--onboard-modal-z-index: 1301 in styles/onboard.css), same as the walletconnect module's QR modal
const WC_MODAL_THEME_VARIABLES = {
  '--wcm-z-index': '1302',
}

// Conservative default gas for a Safe's approveHash(bytes32) call — the only caller that never
// specifies its own gas (dispatchOnChainSigning); a real execution always supplies its own
// estimated gas via useGasLimit. Hedera has no eth_estimateGas equivalent for a not-yet-submitted
// native transaction, so a fixed ceiling is used here instead — mirrors the
// ZK_SYNC_ON_CHAIN_SIGNATURE_GAS_LIMIT precedent in services/tx/tx-sender/dispatch.ts for other
// chains needing an explicit override.
const DEFAULT_APPROVE_HASH_GAS = 200_000

const MIRROR_FETCH_TIMEOUT_MS = 10_000

// WalletConnect's own wc_sessionRequest TTL is ~15 minutes — the window during which it'll
// wait for HashPack's response before rejecting with "Request expired". Our own independent
// mirror-node confirmation (see sendApproveHashTransaction below) races it, capped at ~5 minutes with
// getHederaEvmTransactionHash's backoff curve (~8s ramp-up, then 5s per attempt) — long enough
// for a user to approve in HashPack, without polling the mirror node for the full WC timeout.
const MIRROR_NODE_WATCH_ATTEMPTS = 62

// EIP-1193 4001 / WalletConnect USER_REJECTED. Hedera's own 9000 is INVALID_PARAMS, not a decline.
const USER_REJECTED_CODES = new Set([4001, 5000])
const USER_REJECTED_MESSAGE = /reject|denied|cancel/i

/**
 * WalletConnect rejects with a plain `{ code, message }` object, not an Error — normalize it so a
 * user decline surfaces as EIP-1193's 4001, which onboard, ethers (`ACTION_REJECTED`) and
 * `isWalletRejection` all recognise.
 */
export const toProviderError = (err: unknown): Error & { code?: number } => {
  const { code, message } = (typeof err === 'object' && err !== null ? err : {}) as {
    code?: unknown
    message?: unknown
  }
  const text = typeof message === 'string' ? message : String(err)

  if ((typeof code === 'number' && USER_REJECTED_CODES.has(code)) || USER_REJECTED_MESSAGE.test(text)) {
    return Object.assign(new Error('User rejected the request.'), { code: 4001 })
  }
  if (err instanceof Error) return err
  return Object.assign(new Error(text), typeof code === 'number' ? { code } : {})
}

// HashPack only signs native Hedera transactions over this session — it has no EVM message or
// EIP-712 signing, and an ED25519 account couldn't produce an ecrecover-valid signature anyway.
const UNSUPPORTED_SIGNING_METHODS = new Set([
  'eth_sign',
  'personal_sign',
  'eth_signTypedData',
  'eth_signTypedData_v3',
  'eth_signTypedData_v4',
  'eth_signTransaction',
])

const hexToBytes = (hex: string): Uint8Array => {
  const clean = hex.replace(/^0x/, '')
  const bytes = new Uint8Array(clean.length / 2)
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(clean.substring(i * 2, i * 2 + 2), 16)
  }
  return bytes
}

/**
 * HashPack is reached over WalletConnect, not an injected provider — there is no
 * `window.hashpack` to wrap.
 *
 * Hedera owners always approve Safe transactions on-chain via `approveHash()` (see `signTx`
 * in `components/tx/shared/hooks.ts`). Hedera accounts can be ED25519- or ECDSA-keyed, and
 * only ECDSA accounts can ever produce an `ecrecover`-valid EVM signature — so this module
 * never requests an eip155/`eth_sendTransaction`-style WalletConnect method (HashPack blocks
 * ED25519 accounts from a session that requires one). Instead, the only signing method this
 * provider exposes, `eth_sendTransaction`, is translated internally into a native Hedera
 * `ContractExecuteTransaction` submitted via `hedera_signAndExecuteTransaction` — a
 * key-type-agnostic Hedera-native call that works for both ECDSA and ED25519 accounts.
 *
 * Everything else — every standard read-only EVM RPC method (`eth_call`, `eth_getCode`,
 * `eth_blockNumber`, `eth_getBalance`, `eth_gasPrice`, …) — is proxied straight to the chain's
 * own public RPC endpoint (Hashio). HashPack has no EVM JSON-RPC of its own to ask, and several
 * callers (web3-onboard's balance lookup, ethers' `BrowserProvider`, the Safe creation flow)
 * call these directly against a connected wallet's own provider, not just this app's separate
 * read-only provider — so this module needs to be able to answer them all, not just the ones
 * discovered so far.
 */
const HashPackModule = (chain: Chain): WalletInit => {
  return () => {
    // Only show HashPack for Hedera chains
    const network = getHederaNetwork(chain)
    if (!network || !WC_PROJECT_ID) {
      return null
    }

    return {
      label: HASHPACK_MODULE_LABEL,
      getIcon: async () => (await import('./icon')).default,
      getInterface: async () => {
        const [
          {
            DAppConnector,
            HederaJsonRpcMethod,
            HederaSessionEvent,
            accountAndLedgerFromSession,
            ledgerIdToCAIPChainId,
            transactionToBase64String,
          },
          { LedgerId, Client, ContractId, ContractExecuteTransaction, TransactionId },
        ] = await Promise.all([import('@hashgraph/hedera-wallet-connect'), import('@hiero-ledger/sdk')])

        const ledgerId = LedgerId.fromString(network)
        const hederaChainId = ledgerIdToCAIPChainId(ledgerId)

        const createDAppConnector = async () => {
          const connector = new DAppConnector(
            {
              name: BRAND_NAME,
              description: `${BRAND_NAME} — Hedera`,
              url: window.location.origin,
              icons: [`${window.location.origin}/images/logo-round.svg`],
            },
            ledgerId,
            WC_PROJECT_ID,
            // Native Hedera methods only — never an eip155/ECDSA-only method (see module doc comment above).
            Object.values(HederaJsonRpcMethod),
            [HederaSessionEvent.ChainChanged, HederaSessionEvent.AccountsChanged],
            [hederaChainId],
          )

          // DAppConnector builds its own QR modal with WalletConnect's default z-index, which onboard's
          // "Connecting to HashPack…" modal would cover whenever no extension is found (e.g. incognito)
          connector.walletConnectModal.setTheme({ themeVariables: WC_MODAL_THEME_VARIABLES })

          await connector.init({ logger: 'error' })
          return connector
        }

        let connectorPromise = dAppConnectors.get(network)
        if (!connectorPromise) {
          connectorPromise = createDAppConnector()
          dAppConnectors.set(network, connectorPromise)
          connectorPromise.catch(() => dAppConnectors.delete(network))
        }
        const dAppConnector = await connectorPromise

        // The library's own disconnect() keeps the session's signer, and the connector outlives this
        // interface — a leftover signer would be disconnected again when the same account reconnects
        const disconnectSession = async (topic: string) => {
          await dAppConnector.disconnect(topic)
          dAppConnector.signers = dAppConnector.signers.filter((signer) => signer.topic !== topic)
        }

        // A session's own account+ledger, not just the account — 0.0.123 on mainnet and 0.0.123
        // on testnet are unrelated accounts, so any code that trusts a session's account id must
        // also check it was actually paired against *this* ledger (see session restore below).
        const getAccountAndLedger = (s: SessionTypes.Struct) => {
          try {
            return accountAndLedgerFromSession(s)[0]
          } catch {
            return undefined
          }
        }

        // Every account the session granted on this ledger — HashPack lets the user approve several
        const getSessionAccountIds = (s: SessionTypes.Struct): string[] => {
          try {
            return accountAndLedgerFromSession(s)
              .filter((entry) => entry.network.toString() === ledgerId.toString())
              .map((entry) => entry.account.toString())
          } catch {
            return []
          }
        }

        // The account this provider signs as: one of the session's accounts, switched only when
        // HashPack reports an accountsChanged/session_update for it
        let activeAccountId: string | undefined

        const pickActiveAccountId = (s: SessionTypes.Struct, reported?: unknown): string | undefined => {
          const accountIds = getSessionAccountIds(s)
          // accountsChanged carries CAIP-10 ids (`hedera:mainnet:0.0.123`)
          const reportedIds = Array.isArray(reported) ? reported.map((id) => String(id).split(':').at(-1)) : []
          const current = activeAccountId && accountIds.includes(activeAccountId) ? activeAccountId : undefined
          return reportedIds.find((id) => !!id && accountIds.includes(id)) ?? current ?? accountIds[0]
        }

        const resolveEvmAddress = async (accountId = activeAccountId): Promise<`0x${string}` | undefined> => {
          if (!accountId) return undefined
          const evmAddress = await getHederaEvmAddress(network, accountId)
          return evmAddress as `0x${string}`
        }

        // Restore an already-approved session from a previous page load, if any — but only one
        // actually paired against *this* ledger. The underlying WalletConnect client/session
        // store is shared across every DAppConnector instantiated with the same project id, so a
        // session left over from Hedera mainnet must never be silently reused while viewing
        // testnet (or vice versa): the same account number can be a completely different, unrelated
        // account on each ledger.
        //
        // Only the newest one is kept: every connect leaves a session behind, and DAppConnector signs
        // through the first stored session for the account — often a stale one whose topic this
        // client no longer listens on, so HashPack's reply (e.g. a rejection) never arrives.
        const [newestSession, ...staleSessions] = (dAppConnector.walletConnectClient?.session.getAll() ?? [])
          .filter((s) => getAccountAndLedger(s)?.network.toString() === ledgerId.toString())
          .sort((a, b) => b.expiry - a.expiry)
        await Promise.all(staleSessions.map((s) => disconnectSession(s.topic)))
        let session: SessionTypes.Struct | undefined = newestSession
        activeAccountId = session && pickActiveAccountId(session)

        const accountsChangedListeners = new Set<(accounts: string[]) => void>()
        const chainChangedListeners = new Set<(chainId: string) => void>()

        const emitAccountsChanged = (accounts: string[]) =>
          accountsChangedListeners.forEach((listener) => listener(accounts))

        const updateActiveAccount = async (s: SessionTypes.Struct, reported?: unknown) => {
          const nextAccountId = pickActiveAccountId(s, reported)
          if (nextAccountId === activeAccountId) return
          activeAccountId = nextAccountId
          const address = await resolveEvmAddress(nextAccountId)
          emitAccountsChanged(address ? [address] : [])
        }

        const client = dAppConnector.walletConnectClient
        client?.on('session_delete', (event) => {
          if (session?.topic === event.topic) {
            session = undefined
            activeAccountId = undefined
            emitAccountsChanged([])
          }
        })
        // HashPack changing the session's granted accounts — the captured `session` is a snapshot
        client?.on('session_update', (event) => {
          if (session?.topic !== event.topic) return
          session = client.session.get(event.topic)
          void updateActiveAccount(session)
        })
        client?.on('session_event', (event) => {
          const activeSession = session
          if (activeSession?.topic !== event.topic) return
          const { name, data } = event.params.event
          if (name === 'accountsChanged') {
            void updateActiveAccount(activeSession, data)
          }
          if (name === 'chainChanged') {
            chainChangedListeners.forEach((listener) => listener(numberToHex(Number(chain.chainId))))
          }
        })

        // Various callers — web3-onboard's own getBalance() helper, ethers' BrowserProvider
        // (network detection, gas estimation, tx-wait polling), and the Safe creation flow —
        // all call standard read-only EVM JSON-RPC methods (eth_call, eth_getCode,
        // eth_blockNumber, eth_getBlockByNumber, eth_gasPrice, eth_maxPriorityFeePerGas, etc.)
        // directly against a connected wallet's own provider, not just this app's separate
        // read-only provider. HashPack itself can't answer any of these (it only understands
        // native Hedera methods), so proxy anything not explicitly overridden below to the
        // chain's own public RPC endpoint (Hashio) — a real EVM-compatible JSON-RPC relay.
        const rpcUrl = getRpcServiceUrl(chain.rpcUri)
        const rpcRequest = async (method: string, params: unknown[] = []): Promise<unknown> => {
          const response = await fetch(rpcUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
            signal: AbortSignal.timeout(MIRROR_FETCH_TIMEOUT_MS),
          })
          // Hashio can return a non-JSON error body (e.g. an HTML 502 page) for outages — check
          // the status first so that case surfaces as a clear RPC error, not a JSON parse error.
          if (!response.ok) {
            throw new Error(`Hedera RPC endpoint returned HTTP ${response.status} for ${method}`)
          }
          const { result, error } = (await response.json()) as { result?: unknown; error?: { message: string } }
          if (error) {
            throw new Error(error.message)
          }
          return result
        }

        // findExtensions() (called inside the DAppConnector constructor above) populates
        // dAppConnector.extensions asynchronously via a postMessage round trip with the
        // extension's own content script — poll briefly rather than assuming it's already
        // settled by the time the user clicks "HashPack" (it normally is, but this call can
        // race construction if it happens right after page load). Bounded-attempts, same shape
        // as the mirror-node polling in getHederaEvmTransactionHash (utils/hedera.ts).
        const EXTENSION_DETECT_ATTEMPTS = 8
        const EXTENSION_DETECT_POLL_MS = 100

        const findHashPackExtension = async () => {
          for (let attempt = 0; attempt < EXTENSION_DETECT_ATTEMPTS; attempt++) {
            // HashPack's own extension only — another Hedera wallet's extension would connect under this label
            const found = dAppConnector.extensions.find((ext) => ext.available && /hashpack/i.test(ext.name ?? ''))
            if (found) return found
            await new Promise((resolve) => setTimeout(resolve, EXTENSION_DETECT_POLL_MS))
          }
          return undefined
        }

        const connect = async (): Promise<[`0x${string}`]> => {
          // Prefer connecting directly to an installed HashPack browser extension — it skips
          // WalletConnect's own generic QR/wallet-picker modal entirely (which otherwise shows
          // HashPack redundantly a second time) and goes straight to the extension's own
          // approval popup. Only fall back to the modal's QR code when no extension is detected,
          // to pair HashPack mobile. Closing the modal must reject (`throwErrorOnReject`) — with a
          // 4001, or onboard keeps showing "Connecting to HashPack…" until the proposal expires.
          try {
            const extension = await findHashPackExtension()
            session = extension
              ? await dAppConnector.connectExtension(extension.id)
              : await dAppConnector.openModal(undefined, true)
          } catch (err) {
            throw toProviderError(err)
          }
          activeAccountId = pickActiveAccountId(session)
          const address = await resolveEvmAddress()
          if (!address) {
            throw new Error('HashPack did not approve a usable Hedera session. Please update HashPack and try again.')
          }
          return [address]
        }

        const sendApproveHashTransaction = async (params: {
          from?: string
          to: string
          data: string
          gas?: string | number
          value?: string
        }): Promise<string> => {
          const accountId = activeAccountId
          if (!session || !accountId) {
            throw new Error('HashPack not connected')
          }

          // The tx is always paid/signed by the connected session's own account — fail closed
          // rather than silently signing from a different account than the caller believes it's
          // requesting from, if the two ever diverge (e.g. a stale request racing an account switch).
          if (params.from) {
            const fromAddress = await resolveEvmAddress(accountId)
            if (!fromAddress || fromAddress.toLowerCase() !== params.from.toLowerCase()) {
              throw new Error('HashPack account mismatch: the connected account no longer matches this request')
            }
          }

          // Safe's own execTransaction/approveHash calls are never sent with an attached value —
          // the Safe's own balance funds any inner transfer, not the caller's tx value — so this
          // should never actually be reached. Fail loudly instead of silently dropping a nonzero
          // value we don't otherwise support/convert (see hedera.ts: Hedera's EVM value semantics
          // are tinybar-native, NOT the weibar convention eth_sendTransaction callers normally use).
          if (params.value && BigInt(params.value) !== 0n) {
            throw new Error('HashPack: sending a native value alongside a contract call is not supported')
          }

          const gas = params.gas ? Number(params.gas) : DEFAULT_APPROVE_HASH_GAS

          // ContractId.fromEvmAddress() encodes both a contractNum (0) and an evmAddress on the
          // id, which relies on a protobuf `oneof` that doesn't reliably survive a serialize →
          // WalletConnect → deserialize round trip — HashPack ends up signing a transaction
          // targeting contract 0.0.0 instead of the intended one. Resolve the real native
          // contractNum-based id via the mirror node instead; see utils/hedera.ts for details.
          const contractId = await getHederaContractId(network, params.to)

          // Generated client-side, before anything is sent to HashPack — this is the one piece
          // of the transaction we know for certain regardless of whether HashPack's own response
          // ever makes it back to us.
          const transactionId = TransactionId.generate(accountId)

          // Client.forName() has no operator account configured, so freezeWith can't
          // auto-derive a payer/TransactionId the way it would with a real client — it must be
          // set explicitly first (mirrors DAppSigner.populateTransaction's own internal pattern).
          const tx = new ContractExecuteTransaction()
            .setContractId(ContractId.fromString(contractId))
            .setGas(gas)
            .setFunctionParameters(hexToBytes(params.data))
            .setTransactionId(transactionId)
            .freezeWith(Client.forName(network))

          // A session can be left without a subscription — e.g. dropped by a second connector on an
          // earlier page load, and persisted — so HashPack's reply would never arrive. Re-subscribe.
          const relayer = dAppConnector.walletConnectClient?.core.relayer
          if (relayer && !relayer.subscriber.topics.includes(session.topic)) {
            await relayer.subscribe(session.topic)
          }

          // The library's declared `SignAndExecuteTransactionResult` type wraps this in a full
          // JSON-RPC envelope (`{ id, jsonrpc, result }`), but the underlying WalletConnect
          // `signClient.request()` already unwraps it — DAppConnector/DAppSigner's own internal
          // code (dist/lib/dapp/DAppSigner.js) destructures fields directly with no `.result`,
          // confirming the declared type doesn't match the actual runtime shape.
          const signAndExecute = (async () => {
            const result = (await dAppConnector.signAndExecuteTransaction({
              signerAccountId: `${hederaChainId}:${accountId}`,
              transactionList: transactionToBase64String(tx),
            })) as unknown as TransactionResponseJSON

            // `result.transactionHash` is Hedera's own SHA-384 transaction hash — a different
            // value entirely from the keccak-based hash EVM tooling (ethers' BrowserProvider
            // polling eth_getTransactionByHash to confirm a deployment, in particular) expects
            // back from eth_sendTransaction. Resolve the real EVM-equivalent hash instead.
            return getHederaEvmTransactionHash(network, result.transactionId)
          })()

          // Started concurrently, not just as a fallback after signAndExecute fails — watching
          // from the very start (rather than waiting out WalletConnect's own ~15-minute timeout first)
          const stopWatching = new AbortController()
          const mirrorNodeWatch = getHederaEvmTransactionHash(
            network,
            transactionId.toString(),
            MIRROR_NODE_WATCH_ATTEMPTS,
            stopWatching.signal,
          )

          return await new Promise<string>((resolve, reject) => {
            let wcFailed = false
            let watchFailed = false
            let lastError: Error | undefined

            signAndExecute.then(resolve).catch((err) => {
              const error = toProviderError(err)
              // An explicit user decline is a definite, immediate answer — never worth waiting on
              // the mirror-node watch for (which would otherwise keep the UI loading for ~5 minutes)
              if (error.code === 4001) {
                reject(error)
                return
              }
              wcFailed = true
              lastError ??= error
              if (watchFailed) reject(lastError)
            })

            mirrorNodeWatch.then(resolve).catch((err) => {
              watchFailed = true
              lastError ??= toProviderError(err)
              if (wcFailed) reject(lastError)
            })
          }).finally(() => stopWatching.abort())
        }

        return {
          provider: createEIP1193Provider(
            {
              on: (event: string, listener: (...args: unknown[]) => void) => {
                if (event === 'accountsChanged') {
                  accountsChangedListeners.add(listener as (accounts: string[]) => void)
                }
                if (event === 'chainChanged') {
                  chainChangedListeners.add(listener as (chainId: string) => void)
                }
              },

              // createEIP1193Provider (@web3-onboard/common) only patches `.request` onto this
              // object and returns it as-is — it does not add removeListener/off itself, so a
              // caller that tears down its own listeners on unmount/reconnect (e.g. ethers'
              // BrowserProvider) needs a real implementation here, not just `on`.
              removeListener: (event: string, listener: (...args: unknown[]) => void) => {
                if (event === 'accountsChanged') {
                  accountsChangedListeners.delete(listener as (accounts: string[]) => void)
                }
                if (event === 'chainChanged') {
                  chainChangedListeners.delete(listener as (chainId: string) => void)
                }
              },

              request: async ({ method, params }: { method: string; params?: unknown[] }) => {
                // Hashio can't sign either — forwarding these only surfaced as an opaque HTTP 400
                if (UNSUPPORTED_SIGNING_METHODS.has(method)) {
                  throw Object.assign(
                    new Error(
                      `HashPack can't create off-chain signatures (${method}). Use an ECDSA wallet such as MetaMask for this action.`,
                    ),
                    { code: 4200 },
                  )
                }
                return rpcRequest(method, params)
              },

              disconnect: async () => {
                if (session) {
                  await disconnectSession(session.topic).catch(() => undefined)
                  session = undefined
                  activeAccountId = undefined
                }
              },
            },
            {
              eth_chainId: async () => numberToHex(Number(chain.chainId)),
              eth_accounts: async () => {
                const address = session && (await resolveEvmAddress())
                return address ? [address] : []
              },
              eth_requestAccounts: async () => {
                const address = session && (await resolveEvmAddress())
                return address ? [address] : connect()
              },
              // @ts-expect-error — onboard types expect specific params
              eth_sendTransaction: async ({
                params,
              }: {
                params: [{ from?: string; to: string; data: string; gas?: string; value?: string }]
              }) => {
                if (!session) {
                  await connect()
                }
                return sendApproveHashTransaction(params[0])
              },
            },
          ),
        }
      },
      platforms: ['desktop'],
    }
  }
}

export default HashPackModule
