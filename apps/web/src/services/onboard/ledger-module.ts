import type { DmkError, ExecuteDeviceActionReturnType } from '@ledgerhq/device-management-kit'
import { makeError } from 'ethers'
import type {
  GetAddressDAOutput,
  SignPersonalMessageDAOutput,
  SignTransactionDAOutput,
  SignTypedDataDAOutput,
  TypedData,
} from '@ledgerhq/device-signer-kit-ethereum'
import type { Chain, WalletInit, WalletInterface } from '@web3-onboard/common'
import type { Account, Asset, BasePath, DerivationPath, ScanAccountsOptions } from '@web3-onboard/hw-common'
import type { Subscription } from 'rxjs'
import { getRskAddress } from '@safe-global/utils/utils/rsk-utils'

const LEDGER_LIVE_PATH: DerivationPath = "44'/60'"
const LEDGER_LEGACY_PATH: DerivationPath = "44'/60'/0'"
const ROOTSTOCK_MAINNET_PATH: DerivationPath = "44'/137'/0'/0"
const ROOTSTOCK_TESTNET_PATH: DerivationPath = "44'/37310'/0'/0"

const ROOTSTOCK_MAINNET_PREFIX = "44'/137'"
const ROOTSTOCK_TESTNET_PREFIX = "44'/37310'"

const DEFAULT_BASE_PATHS: Array<BasePath> = [
  {
    label: 'Ledger Live',
    value: LEDGER_LIVE_PATH,
  },
  {
    label: 'Ledger Legacy',
    value: LEDGER_LEGACY_PATH,
  },
]

const ROOTSTOCK_BASE_PATHS: Array<BasePath> = [
  {
    label: 'Rootstock',
    value: ROOTSTOCK_MAINNET_PATH,
  },
  {
    label: 'Rootstock testnet',
    value: ROOTSTOCK_TESTNET_PATH,
  },
]

const isRskDerivationPath = (derivationPath: string): boolean =>
  derivationPath.startsWith(ROOTSTOCK_MAINNET_PREFIX) || derivationPath.startsWith(ROOTSTOCK_TESTNET_PREFIX)

// `isRsk` is true only when Rootstock support is enabled and the current chain is Rootstock
const isRskAccountPath = (isRsk: boolean, derivationPath: string): boolean =>
  isRsk && isRskDerivationPath(derivationPath)

const getBasePaths = (isRsk: boolean): Array<BasePath> =>
  isRsk ? [...DEFAULT_BASE_PATHS, ...ROOTSTOCK_BASE_PATHS] : DEFAULT_BASE_PATHS

const isBasePath = (isRsk: boolean, derivationPath: string): boolean =>
  getBasePaths(isRsk).some((basePath) => basePath.value === derivationPath)

// Rootstock paths are served by the Rootstock app, so the Ethereum app must not be auto-opened
const skipOpenAppOption = (skipOpenApp: boolean) => (skipOpenApp ? { skipOpenApp: true } : {})

const skipOpenAppArgs = (skipOpenApp: boolean): [{ skipOpenApp: true }] | [] =>
  skipOpenApp ? [{ skipOpenApp: true }] : []

type LedgerTxParams = {
  gasPrice?: string | number | bigint | null
  maxFeePerGas?: string | number | bigint | null
  maxPriorityFeePerGas?: string | number | bigint | null
}

type LegacyTxOverrides = {
  type: 0
  gasPrice: bigint
  maxFeePerGas: null
  maxPriorityFeePerGas: null
}

/**
 * Rootstock only accepts legacy transactions, while ethers infers a typed transaction otherwise.
 * Type 0 is pinned whenever the EIP-1559 fee-cap pair is not complete.
 */
function getRskLegacyTxOverrides(isRsk: boolean, txParams: LedgerTxParams): Partial<LegacyTxOverrides> {
  const hasEip1559Fees = Boolean(txParams.maxFeePerGas && txParams.maxPriorityFeePerGas)
  if (!isRsk || hasEip1559Fees) {
    return {}
  }

  const gasPrice = txParams.gasPrice ? BigInt(txParams.gasPrice) : 0n
  if (gasPrice === 0n) {
    throw new Error('Rootstock legacy transactions require a gas price')
  }

  return { type: 0, gasPrice, maxFeePerGas: null, maxPriorityFeePerGas: null }
}

const DEFAULT_ASSETS: Array<Asset> = [
  {
    label: 'ETH',
  },
]

// `rootstockChainIds` are the decimal ids of chains with the ROOTSTOCK_SUPPORT flag
export function ledgerModule(rootstockChainIds: string[] = []): WalletInit {
  return () => {
    return {
      label: 'Ledger',
      getIcon: async (): Promise<string> => `
<svg width="160" height="160" viewBox="0 0 160 160" fill="none" xmlns="http://www.w3.org/2000/svg">
<rect width="160" height="160" rx="16" fill="#00000D"/>
<path d="M93.1482 119.207V125H135V98.8769H128.902V119.207H93.1482ZM93.1482 33V38.792H128.902V59.1231H135V33H93.1482ZM74.0104 59.1231H67.9125V98.8769H95.4153V93.6539H74.0104V59.1231ZM26 98.8769V125H67.8518V119.207H32.0979V98.8769H26ZM26 33V59.1231H32.0979V38.792H67.8518V33H26Z" fill="white"/>
</svg>`,
      getInterface: async ({ chains, EventEmitter }): Promise<WalletInterface> => {
        const DEFAULT_CHAIN = chains[0]

        const { BigNumber } = await import('@ethersproject/bignumber')
        const { hexaStringToBuffer } = await import('@ledgerhq/device-management-kit')
        const { createEIP1193Provider, ProviderRpcError, ProviderRpcErrorCode } = await import('@web3-onboard/common')
        const { accountSelect, getHardwareWalletProvider } = await import('@web3-onboard/hw-common')
        const { Signature, Transaction, JsonRpcProvider } = await import('ethers')

        const eventEmitter = new EventEmitter()
        const ledgerSdk = await getLedgerSdk()

        /* -------------------------------------------------------------------------- */
        /*                                    State                                   */
        /* -------------------------------------------------------------------------- */

        let currentChain = DEFAULT_CHAIN
        let currentAccount: Account | null = null
        // Web3-Onboard chain ids are hex strings, e.g. '0x1e' for Rootstock mainnet
        const isRskNetwork = (): boolean => rootstockChainIds.includes(String(Number(currentChain.id)))
        // The account modal fixes its path list on open, before the user picks a network in it
        const hasRskChains = rootstockChainIds.length > 0

        // Sets the current chain and emits the chainChanged event
        function setCurrentChain(chainId: Chain['id']): void {
          const newChain = chains.find((chain) => chain.id === chainId)
          if (!newChain) {
            throw new ProviderRpcError({
              code: ProviderRpcErrorCode.UNRECOGNIZED_CHAIN_ID,
              message: `Unrecognized chain ID: ${chainId}`,
            })
          }
          currentChain = newChain
          eventEmitter.emit('chainChanged', currentChain.id)
        }

        // Sets the current account and emits the accountsChanged event
        function setCurrentAccount(account: Account): void {
          currentAccount = account
          eventEmitter.emit('accountsChanged', [currentAccount.address])
        }

        // Clears the current account and emits the accountsChanged event
        function clearCurrentAccount(): void {
          currentAccount = null
          eventEmitter.emit('accountsChanged', [])
        }

        // Clears the current chain and emits the chainChanged event
        function clearCurrentChain(): void {
          currentChain = DEFAULT_CHAIN
          eventEmitter.emit('chainChanged', currentChain.id)
        }

        // Gets the asserted derivation path from the current account
        function getAssertedDerivationPath(): DerivationPath {
          if (!currentAccount?.derivationPath) {
            throw new ProviderRpcError({
              code: -32000, // Method handler crashed
              message: 'No derivation path found',
            })
          }
          return currentAccount.derivationPath
        }

        /* -------------------------------------------------------------------------- */
        /*                              EIP-1193 provider                             */
        /* -------------------------------------------------------------------------- */

        const eip1193Provider = createEIP1193Provider(
          getHardwareWalletProvider(() => {
            const rpcUrl = currentChain.rpcUrl
            if (!rpcUrl) {
              throw new ProviderRpcError({
                code: ProviderRpcErrorCode.UNRECOGNIZED_CHAIN_ID,
                message: `No RPC found for chain ID: ${currentChain.id}`,
              })
            }
            return rpcUrl
          }),
          {
            eth_requestAccounts: async () => {
              const accounts = await getAccounts()
              return [accounts[0].address]
            },
            eth_selectAccounts: async () => {
              const accounts = await getAccounts()
              return accounts.map((account) => account.address)
            },
            eth_accounts: async () => {
              if (!currentAccount) {
                return []
              }
              return [currentAccount.address]
            },
            eth_chainId: async () => {
              return currentChain.id
            },
            eth_signTransaction: async (args) => {
              const txParams = args.params[0]

              const gasLimit = txParams.gas ?? txParams.gasLimit
              const nonce =
                txParams.nonce ??
                // Safe creation does not provide nonce
                ((await eip1193Provider.request({
                  method: 'eth_getTransactionCount',
                  // Take pending transactions into account
                  params: [currentAccount!.address, 'pending'],
                })) as string)

              const transaction = Transaction.from({
                chainId: BigInt(currentChain.id),
                data: txParams.data,
                gasLimit: gasLimit ? BigInt(gasLimit) : null,
                gasPrice: txParams.gasPrice ? BigInt(txParams.gasPrice) : null,
                maxFeePerGas: txParams.maxFeePerGas ? BigInt(txParams.maxFeePerGas) : null,
                maxPriorityFeePerGas: txParams.maxPriorityFeePerGas ? BigInt(txParams.maxPriorityFeePerGas) : null,
                nonce: parseInt(nonce, 16),
                to: txParams.to,
                value: txParams.value ? BigInt(txParams.value) : null,
                ...getRskLegacyTxOverrides(isRskNetwork(), txParams),
              })

              // Calculate hash and show comparison dialog before signing
              const { keccak256 } = await import('ethers')
              const txHash = keccak256(transaction.unsignedSerialized)

              const { showLedgerHashComparison, hideLedgerHashComparison } = await import('@/features/ledger')
              showLedgerHashComparison(txHash)

              try {
                // Sign transaction on Ledger device
                const derivationPath = getAssertedDerivationPath()
                transaction.signature = await ledgerSdk.signTransaction(
                  derivationPath,
                  hexaStringToBuffer(transaction.unsignedSerialized)!,
                  isRskAccountPath(isRskNetwork(), derivationPath),
                )

                // Hide dialog after successful signing
                hideLedgerHashComparison()

                return transaction.serialized
              } catch (error) {
                // Hide dialog on error (rejection or failure)
                hideLedgerHashComparison()
                throw error
              }
            },
            eth_sendTransaction: async (args) => {
              const signedTransaction = await eip1193Provider.request({
                method: 'eth_signTransaction',
                params: args.params,
              })
              return (await eip1193Provider.request({
                method: 'eth_sendRawTransaction',
                params: [signedTransaction],
              })) as string
            },
            eth_sign: async (args) => {
              // The Safe requires transactions be signed as bytes, but eth_sign is only used by
              // the Transaction Service, e.g. notification registration. We therefore sign
              // messages as is to avoid unreadable byte notation (e.g. \xef\xbe\xad\xde). Instead,
              // the Ledger device shows plain hex (e.g. 0xdeadbeef).
              const message = args.params[1]
              const derivationPath = getAssertedDerivationPath()
              const signature = await ledgerSdk.signMessage(
                derivationPath,
                message,
                isRskAccountPath(isRskNetwork(), derivationPath),
              )
              return Signature.from(signature).serialized
            },
            personal_sign: async (args) => {
              // personal_sign params are the inverse of eth_sign
              const [message, address] = args.params
              return await eip1193Provider.request({
                method: 'eth_sign',
                params: [address, message],
              })
            },
            eth_signTypedData: async (args) => {
              const typedData = JSON.parse(args.params[1])
              const derivationPath = getAssertedDerivationPath()
              const signature = await ledgerSdk.signTypedData(
                derivationPath,
                typedData,
                isRskAccountPath(isRskNetwork(), derivationPath),
              )
              return Signature.from(signature).serialized
            },
            // @ts-expect-error createEIP1193Provider does not allow overriding eth_signTypedData_v3
            eth_signTypedData_v3: async (args) => {
              return await eip1193Provider.request({ method: 'eth_signTypedData', params: args.params })
            },
            // @ts-expect-error createEIP1193Provider does not allow overriding eth_signTypedData_v4
            eth_signTypedData_v4: async (args) => {
              return await eip1193Provider.request({ method: 'eth_signTypedData', params: args.params })
            },
            wallet_switchEthereumChain: async (args) => {
              const chainId = args.params[0].chainId
              setCurrentChain(chainId)
              return null
            },
          },
        )

        // Disconnects Ledger device and clears current account and chain
        eip1193Provider.disconnect = async () => {
          await ledgerSdk.disconnect()
          clearCurrentAccount()
          clearCurrentChain()
        }

        // createEIP1193Provider does not bind EventEmitter
        eip1193Provider.on = eventEmitter.on.bind(eventEmitter)
        eip1193Provider.removeListener = eventEmitter.removeListener.bind(eventEmitter)

        /* -------------------------------------------------------------------------- */
        /*                       Web3-Onboard account selection                       */
        /* -------------------------------------------------------------------------- */

        /**
         * Gets a list of derived accounts from Ledger device for selection
         * and sets the first account as the current account
         */
        async function getAccounts(): Promise<Array<Account>> {
          const accounts = await accountSelect({
            basePaths: getBasePaths(hasRskChains),
            assets: DEFAULT_ASSETS,
            chains,
            scanAccounts: deriveAccounts,
          })

          if (accounts.length > 0) {
            setCurrentAccount(accounts[0])
          }

          return accounts
        }

        /**
         * Gets a list of derived accounts from Ledger device for selection
         * If a custom derivation path is provided, one account is returned
         * otherwise a minimum of 5 accounts are returned
         */
        async function deriveAccounts(args: ScanAccountsOptions): Promise<Array<Account>> {
          const MAX_ZERO_BALANCE_ACCOUNTS = 5

          setCurrentChain(args.chainId)

          const provider = new JsonRpcProvider(currentChain.rpcUrl)

          // Only return exact account from custom derivation
          if (!isBasePath(hasRskChains, args.derivationPath)) {
            const account = await deriveAccount({ ...args, provider })
            return [account]
          }

          const accounts = []

          let zeroBalanceAccounts = 0
          let index = 0

          // Iterates until 0 balance account, then add 4 more 0 balance accounts after
          while (zeroBalanceAccounts < MAX_ZERO_BALANCE_ACCOUNTS) {
            const account = await deriveAccount({
              derivationPath:
                args.derivationPath === LEDGER_LIVE_PATH
                  ? `${args.derivationPath}/${index}'/0/0`
                  : `${args.derivationPath}/${index}`,
              provider,
              asset: args.asset,
            })
            accounts.push(account)

            if (account.balance.value.isZero()) {
              zeroBalanceAccounts++
            } else {
              zeroBalanceAccounts = 0
            }

            index++
          }

          return accounts
        }

        // Gets derived account from Ledger device for selection in Web3-Onboard
        async function deriveAccount(args: {
          derivationPath: string
          provider: InstanceType<typeof JsonRpcProvider>
          asset: Asset
        }): Promise<Account> {
          const isRskPath = isRskAccountPath(isRskNetwork(), args.derivationPath)
          const { address: deviceAddress } = await ledgerSdk.getAddress(args.derivationPath, isRskPath)
          // Rootstock devices return EIP-1191 checksums, which ethers rejects unless normalized
          const address = isRskPath ? (getRskAddress(deviceAddress) as `0x${string}`) : deviceAddress
          const balance = await args.provider.getBalance(address)

          return {
            derivationPath: args.derivationPath,
            address,
            balance: {
              asset: args.asset.label,
              value: BigNumber.from(balance),
            },
          }
        }

        return {
          provider: eip1193Provider,
        }
      },
    }
  }
}

const enum LedgerErrorCode {
  REJECTED = '6985',
}

// Promisified Ledger SDK
async function getLedgerSdk() {
  const { DeviceManagementKitBuilder } = await import('@ledgerhq/device-management-kit')
  const { webHidTransportFactory, webHidIdentifier } = await import('@ledgerhq/device-transport-kit-web-hid')
  const { SignerEthBuilder } = await import('@ledgerhq/device-signer-kit-ethereum')
  const { lastValueFrom } = await import('rxjs')

  // Get connected device and create signer
  const dmk = new DeviceManagementKitBuilder().addTransport(webHidTransportFactory).build()
  const device = await lastValueFrom(dmk.startDiscovering({ transport: webHidIdentifier }))
  const sessionId = await dmk.connect({ device })
  const signer = new SignerEthBuilder({ dmk, sessionId, originToken: 'your-origin-token' }).build()

  // Pause the DMK device-session refresher for the duration of on-device signing.
  // On device-management-kit 0.9.1 the refresher keeps polling the device (GetAppAndVersion,
  // ~2s interval, 800ms abort) while a signature is in flight. The WebHID transport shares a
  // single response resolver, so a poll that aborts releases the command mutex while the device
  // reply is still pending; a late reply then resolves the signing request and corrupts APDU
  // framing (surfacing as InvalidStatusWordError). This backports the fix from DMK 1.1.0
  // ("don't ping when an intent is being processed") and can be removed once the kit is upgraded.
  const withRefresherPaused = async <T>(action: () => Promise<T>): Promise<T> => {
    const resumeRefresher = dmk.disableDeviceSessionRefresher({ sessionId, blockerId: 'safe-signing' })
    try {
      return await action()
    } finally {
      resumeRefresher()
    }
  }

  return {
    disconnect: async (): Promise<void> => {
      return dmk.disconnect({ sessionId })
    },
    getAddress: async (derivationPath: string, skipOpenApp: boolean): Promise<GetAddressDAOutput> => {
      return waitForAction(
        signer.getAddress(derivationPath, { checkOnDevice: false, ...skipOpenAppOption(skipOpenApp) }),
      )
    },
    signMessage: async (
      derivationPath: string,
      message: string | Uint8Array,
      skipOpenApp: boolean,
    ): Promise<SignPersonalMessageDAOutput> => {
      return withRefresherPaused(() =>
        waitForAction(signer.signMessage(derivationPath, message, ...skipOpenAppArgs(skipOpenApp))),
      )
    },
    signTransaction: async (
      derivationPath: string,
      transaction: Uint8Array,
      skipOpenApp: boolean,
    ): Promise<SignTransactionDAOutput> => {
      return withRefresherPaused(() =>
        waitForAction(signer.signTransaction(derivationPath, transaction, ...skipOpenAppArgs(skipOpenApp))),
      )
    },
    signTypedData: async (
      derivationPath: string,
      typedData: TypedData,
      skipOpenApp: boolean,
    ): Promise<SignTypedDataDAOutput> => {
      return withRefresherPaused(() =>
        waitForAction(signer.signTypedData(derivationPath, typedData, ...skipOpenAppArgs(skipOpenApp))),
      )
    },
  }
}

async function waitForAction<Output, Error extends DmkError, IntermediateValue>({
  observable,
}: ExecuteDeviceActionReturnType<Output, Error, IntermediateValue>): Promise<Output> {
  const { DeviceActionStatus } = await import('@ledgerhq/device-management-kit')

  let subscription: Subscription | undefined

  try {
    return await new Promise((resolve, reject) => {
      subscription = observable.subscribe({
        next: (actionState) => {
          if (actionState.status === DeviceActionStatus.Completed) {
            resolve(actionState.output)
          } else if (actionState.status === DeviceActionStatus.Error) {
            reject(mapEthersError(actionState.error))
          } else {
            // Awaiting user action, e.g. device to be unlocked. We could throw
            // an explicit error message but we keep the signing request alive
          }
        },
      })
    })
  } finally {
    subscription?.unsubscribe()
  }
}

function mapEthersError(error: DmkError) {
  const isRejection = 'errorCode' in error ? error.errorCode === LedgerErrorCode.REJECTED : false

  if (!isRejection) {
    return makeError(error.message ?? 'unknown', 'UNKNOWN_ERROR', {
      info: error,
    })
  }

  return makeError('user rejected action', 'ACTION_REJECTED', {
    action: 'unknown',
    reason: 'rejected',
    info: error,
  })
}
