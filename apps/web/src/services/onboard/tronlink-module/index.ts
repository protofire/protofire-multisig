import type { WalletInit } from '@web3-onboard/common'
import { createEIP1193Provider, ProviderRpcError, ProviderRpcErrorCode } from '@web3-onboard/common'
import { BaseError, type Chain as ViemChain } from 'viem'
import type { TronWebLike } from '@dewpointlabs/viem-tron'
import type { Chain } from '@safe-global/store/gateway/AUTO_GENERATED/chains'
import { isTronChain } from '@/utils/tron'
import { numberToHex } from '@/utils/hex'
import { translateTronError } from '@/utils/tron-errors'
import { getRpcServiceUrl } from '@/hooks/wallets/web3'

export const TRONLINK_MODULE_LABEL = 'TronLink'

interface TronLinkEventSource {
  on?: (event: string, listener: (...args: unknown[]) => void) => void
  removeListener?: (event: string, listener: (...args: unknown[]) => void) => void
}

declare global {
  interface Window {
    tronLink?: {
      ready: boolean
      request: (args: { method: string; params?: unknown }) => Promise<unknown>
      tronWeb?: TronWebInstance
    } & TronLinkEventSource
    tron?: TronLinkEventSource
    tronWeb?: TronWebInstance
  }
}

interface TronHttpProvider {
  instance?: {
    defaults?: { headers?: Record<string, unknown> }
    interceptors?: {
      request?: { use: (onFulfilled: (config: TronRequestConfig) => TronRequestConfig) => void }
    }
  }
}

interface TronRequestConfig {
  headers?: Record<string, unknown>
}

interface TronWebInstance extends TronWebLike {
  ready: boolean
  fullNode?: TronHttpProvider & { host?: string }
  solidityNode?: TronHttpProvider
  eventServer?: TronHttpProvider
}

/** Known TronLink full-node hosts. A custom URL must never inherit the app's chain id. */
const TRON_CHAIN_ID_BY_HOST: Record<string, string> = {
  'api.trongrid.io': '728126428',
  'api.shasta.trongrid.io': '2494104990',
  'api.nileex.io': '3448148188',
  'nile.trongrid.io': '3448148188',
}

/** Maps TronLink's configured full node to a Tron chain id (undefined if unrecognised). */
export const detectTronChainId = (fullNodeHost?: string): string | undefined => {
  if (!fullNodeHost) return undefined
  try {
    return TRON_CHAIN_ID_BY_HOST[new URL(fullNodeHost).hostname]
  } catch {
    return undefined
  }
}

/**
 * True only when TronLink's full node maps to a configured Tron chain.
 * Shared by the getInterface throw and the silent-reconnect check in useOnboard.ts, so both
 * agree on what "unsupported" means.
 */
export const isTronLinkOnSupportedNetwork = (tronChainIds: string[]): boolean => {
  if (typeof window === 'undefined') return true
  const tronWeb = window.tronLink?.tronWeb || window.tronWeb
  const detected = detectTronChainId(tronWeb?.fullNode?.host)
  return detected !== undefined && tronChainIds.includes(detected)
}

const TYPED_DATA_METHODS = ['eth_signTypedData_v4', 'eth_signTypedData']

/** The Tron contracts and the gateway expect v + 31 (0x3a/0x3b) on signatures made with the Tron message prefix. */
const withTronV = (signature: string): string =>
  signature.slice(0, -2) + (parseInt(signature.slice(-2), 16) + 31).toString(16)

const TRON_LINK_POLL_INTERVAL_MS = 250
const TRON_LINK_POLL_TIMEOUT_MS = 15_000

/**
 * TronLink 5.x's MV3 service worker can take seconds to inject window.tronLink after
 * navigation, so a wallet-modules computation that runs right after chain configs arrive can
 * miss it. Injection itself posts no event we can listen for, so poll for window.tronLink
 * instead: immediately if already present, otherwise every 250ms for up to 15s before giving
 * up silently. Returns an unsubscribe function.
 */
export const onTronLinkReady = (callback: () => void): (() => void) => {
  if (typeof window === 'undefined') return () => {}

  if (window.tronLink) {
    callback()
    return () => {}
  }

  // Wall-clock, not a tick count: a throttled background tab fires setInterval late/less often,
  // and counting ticks would let the poll window drift well past 15s of real time.
  const start = Date.now()
  const interval = setInterval(() => {
    if (window.tronLink) {
      clearInterval(interval)
      callback()
      return
    }
    if (Date.now() - start >= TRON_LINK_POLL_TIMEOUT_MS) {
      clearInterval(interval)
    }
  }, TRON_LINK_POLL_INTERVAL_MS)

  return () => clearInterval(interval)
}

const TronLinkModule = (appChainId: Chain['chainId'], tronChains: Chain[]): WalletInit => {
  const tronChainIds = tronChains.map((chain) => chain.chainId)

  return () => {
    // EIP-6963 also announces an EVM "TronLink" provider on window.ethereum; only offer the
    // native module, and only when there is a Tron chain configured to connect it to.
    if (typeof window === 'undefined' || !window.tronLink || tronChainIds.length === 0) {
      return null
    }

    return {
      label: TRONLINK_MODULE_LABEL,
      getIcon: async () => (await import('./icon')).default,
      getInterface: async () => {
        const tronLink = window.tronLink
        const tronWeb = tronLink?.tronWeb || window.tronWeb

        if (!tronLink || !tronWeb) {
          throw new Error('TronLink extension not found. Please install TronLink.')
        }

        if (!isTronLinkOnSupportedNetwork(tronChainIds)) {
          // Never silently relabel: reporting e.g. mainnet while TronLink is actually on
          // Shasta would send RPC/tx traffic to the wrong network.
          throw new Error(
            'TronLink is connected to a Tron network this app does not support. Switch the network in TronLink and reconnect.',
          )
        }

        // Detect the chain TronLink is actually pointed at (from its configured full node) so
        // the wallet reports a Tron chainId even when the app is sitting on a non-Tron chain.
        // Scoped here (not module-level) since nothing outside getInterface reads it; `let`
        // because wallet_switchEthereumChain mutates it below.
        const detected = detectTronChainId(tronWeb.fullNode?.host)
        let currentChainId = detected || (isTronChain(appChainId) ? appChainId : tronChainIds[0])

        const waitForAddress = async (maxAttempts = 10): Promise<void> => {
          for (let i = 0; i < maxAttempts; i++) {
            // Re-read from window.tronWeb in case the reference was updated
            const tw = window.tronLink?.tronWeb || window.tronWeb
            if (tw?.ready && tw?.defaultAddress?.hex) return
            await new Promise((r) => setTimeout(r, 300))
          }
        }

        if (!tronWeb.ready || !tronWeb.defaultAddress?.hex) {
          // Request connection
          try {
            await tronLink.request({ method: 'tron_requestAccounts' })
            await waitForAddress()
          } catch (error) {
            throw new Error(translateTronError(error, currentChainId))
          }
        }

        const getAddress = (): string => {
          // Re-read from window in case tronWeb reference was refreshed after connection
          const tw = window.tronLink?.tronWeb || window.tronWeb
          const addr = tw?.defaultAddress?.hex || tronWeb.defaultAddress?.hex
          if (!addr) throw new Error('TronLink not connected')
          // Convert Tron hex (41-prefixed) to 0x format
          return '0x' + addr.slice(2)
        }

        // TronLink extension injects TRON-PRO-API-KEY as a top-level key in axios
        // defaults.headers. The /wallet/* CORS policy doesn't allow this custom header,
        // so the browser blocks ALL POST requests to native Tron API endpoints.
        // Fix: remove the header via axios request interceptor (persists across navigations)
        // and also delete it from defaults for immediate effect.
        const twProviders = [tronWeb.fullNode, tronWeb.solidityNode, tronWeb.eventServer]
        for (const provider of twProviders) {
          if (provider?.instance?.defaults?.headers) {
            delete provider.instance.defaults.headers['TRON-PRO-API-KEY']
          }
          // Add interceptor to strip the header on every request in case TronLink re-injects it
          if (provider?.instance?.interceptors?.request) {
            provider.instance.interceptors.request.use((config: TronRequestConfig) => {
              if (config?.headers) {
                delete config.headers['TRON-PRO-API-KEY']
              }
              return config
            })
          }
        }

        const { tronWebTransport, TronWebTransportError, BroadcastIndeterminateError } = await import(
          '@dewpointlabs/viem-tron'
        )

        // ethers' BrowserProvider forwards only code, message and data of a rejected request, while
        // the transport keeps its own message and the revert data of a read on nested causes.
        const toProviderError = (error: unknown): Error => {
          const outer = error instanceof BaseError ? error : undefined
          const specific = outer?.walk((cause) => cause instanceof TronWebTransportError) ?? outer
          const text =
            specific instanceof BaseError
              ? specific.shortMessage
              : error instanceof Error
                ? error.message
                : String(error)
          const details = outer?.details
          const reverted = outer?.walk((cause) => typeof (cause as { data?: unknown } | null)?.data === 'string')
          const code = (error as { code?: unknown } | null)?.code
          return Object.assign(
            new Error(details && !text.includes(details) ? `${text} Details: ${details}` : text, { cause: error }),
            { code: typeof code === 'number' ? code : undefined, data: (reverted as { data?: string } | null)?.data },
          )
        }

        const chainChangedListeners = new Set<(chainId: string) => void>()
        let activeTronWeb = tronWeb
        let activeFullNodeHost = tronWeb.fullNode?.host
        let networkMismatch = false

        const buildTransport = (chainId: string, resolvedTronWeb?: TronWebInstance) => {
          const currentTronWeb = resolvedTronWeb || window.tronLink?.tronWeb || window.tronWeb || tronWeb
          const chain = tronChains.find((chain) => chain.chainId === chainId)
          const rpc = chain && getRpcServiceUrl(chain.rpcUri)
          if (!rpc) throw new Error(`No RPC URL is configured for Tron chain ${chainId}`)
          return tronWebTransport(currentTronWeb, { rpc })({
            chain: { id: Number(chainId) } as ViemChain,
            retryCount: 0,
          })
        }

        let transport = buildTransport(currentChainId)

        const emitChainChanged = (chainId: string) => {
          chainChangedListeners.forEach((listener) => listener(numberToHex(Number(chainId))))
        }

        const syncTronWeb = (emitEvent: boolean): void => {
          const currentTronWeb = window.tronLink?.tronWeb || window.tronWeb
          if (!currentTronWeb) {
            networkMismatch = true
            return
          }

          const fullNodeHost = currentTronWeb.fullNode?.host
          const detectedChainId = detectTronChainId(fullNodeHost)
          const tronWebChanged = currentTronWeb !== activeTronWeb || fullNodeHost !== activeFullNodeHost
          const chainChanged = detectedChainId !== undefined && detectedChainId !== currentChainId

          const wasMismatch = networkMismatch
          networkMismatch = !detectedChainId || !tronChainIds.includes(detectedChainId)
          if (!tronWebChanged && !chainChanged && !wasMismatch) return

          // Built before the state below changes, so a chain that cannot be served keeps failing here.
          if (!networkMismatch) {
            transport = buildTransport(detectedChainId ?? currentChainId, currentTronWeb)
          }
          activeTronWeb = currentTronWeb
          activeFullNodeHost = fullNodeHost
          if (detectedChainId) {
            currentChainId = detectedChainId
          }
          if (emitEvent && chainChanged) {
            emitChainChanged(currentChainId)
          }
        }

        const assertSupportedNetwork = () => {
          syncTronWeb(true)
          if (networkMismatch) {
            throw new Error(
              'TronLink is connected to a Tron network this app does not support. Switch the network in TronLink and reconnect.',
            )
          }
        }

        const onTronLinkMessage = (event: MessageEvent) => {
          const action = event.data?.message?.action
          if (action === 'setNode' || action === 'chainChanged') {
            syncTronWeb(true)
          }
        }
        window.addEventListener('message', onTronLinkMessage)

        const eventSources = [window.tronLink, window.tron].filter((source): source is TronLinkEventSource =>
          Boolean(source?.on),
        )
        const onChainChanged = () => syncTronWeb(true)
        eventSources.forEach((source) => source.on?.('chainChanged', onChainChanged))

        return {
          provider: createEIP1193Provider(
            {
              on: (event: string, listener: (...args: unknown[]) => void) => {
                if (event === 'chainChanged') {
                  chainChangedListeners.add(listener as (chainId: string) => void)
                }
                // TronLink fires events on window
                if (event === 'accountsChanged' && typeof window !== 'undefined') {
                  const handler = (e: MessageEvent) => {
                    if (e.data?.message?.action === 'setAccount') {
                      listener([getAddress()])
                    }
                    if (e.data?.message?.action === 'disconnect') {
                      listener([])
                    }
                  }
                  window.addEventListener('message', handler)
                }
              },

              request: async ({ method, params }: { method: string; params?: unknown[] }) => {
                assertSupportedNetwork()
                try {
                  const result = await transport.request({ method, params } as Parameters<typeof transport.request>[0])
                  return TYPED_DATA_METHODS.includes(method) ? withTronV(String(result)) : result
                } catch (error) {
                  // The transaction may be on chain: its id is returned to be monitored, not failed and retried.
                  const unknownOutcome =
                    error instanceof BaseError && error.walk((cause) => cause instanceof BroadcastIndeterminateError)
                  if (method === 'eth_sendTransaction' && unknownOutcome instanceof BroadcastIndeterminateError) {
                    return unknownOutcome.transactionId
                  }
                  throw toProviderError(error)
                }
              },

              disconnect: () => {
                // TronLink doesn't have a disconnect method
                window.removeEventListener('message', onTronLinkMessage)
                eventSources.forEach((source) => source.removeListener?.('chainChanged', onChainChanged))
              },
            },
            {
              eth_chainId: async () => {
                assertSupportedNetwork()
                return numberToHex(Number(currentChainId))
              },
              eth_accounts: async () => {
                assertSupportedNetwork()
                return [getAddress() as `0x${string}`]
              },
              eth_requestAccounts: async () => {
                assertSupportedNetwork()
                await tronLink.request({ method: 'tron_requestAccounts' })
                await waitForAddress()
                return [getAddress() as `0x${string}`]
              },

              // @ts-expect-error – onboard types expect specific params
              wallet_switchEthereumChain: async ({ params }: { params: [{ chainId: string }] }) => {
                const newChainId = parseInt(params[0].chainId, 16).toString()
                if (!tronChainIds.includes(newChainId)) {
                  // Not CHAIN_NOT_ADDED (4902): switchOrAddChain in tx-sender/sdk.ts treats that
                  // code as "add the chain" and issues wallet_addEthereumChain, which this
                  // provider doesn't implement — the switch would never reject promptly.
                  throw new ProviderRpcError({
                    code: ProviderRpcErrorCode.UNSUPPORTED_METHOD,
                    message: 'This app does not support the requested TronLink network',
                  })
                }

                // TronLink has no programmatic network switch: rebuilding the transport only
                // changes which RPC WE read from, it can't move TronLink's own node. Never let
                // reads (this transport) and signing/broadcast (TronLink's node) point at
                // different networks — reject unless TronLink is verifiably already on the
                // target chain. An unrecognised custom node (detected === undefined) can't be
                // verified either, so it's rejected too, not let through. Detection runs on the
                // same freshly-resolved TronWeb instance that buildTransport below then uses.
                const freshTronWeb = window.tronLink?.tronWeb || window.tronWeb
                const detected = detectTronChainId(freshTronWeb?.fullNode?.host)
                if (detected !== newChainId) {
                  throw new ProviderRpcError({
                    code: ProviderRpcErrorCode.UNSUPPORTED_METHOD,
                    message: 'Switch the network in TronLink first, then retry',
                  })
                }

                transport = buildTransport(newChainId, freshTronWeb)
                activeTronWeb = freshTronWeb || activeTronWeb
                activeFullNodeHost = activeTronWeb.fullNode?.host
                networkMismatch = false
                currentChainId = newChainId
                emitChainChanged(currentChainId)
              },
            },
          ),
        }
      },
      platforms: ['desktop'],
    }
  }
}

export default TronLinkModule
