import type {
  AddressNameResult,
  ChainClient,
  ChainInfoResult,
  ExternalDataProvider,
  TokenResult,
} from '@ethereum-sourcify/clear-signing'
import type { EntityState } from '@reduxjs/toolkit'
import { ZERO_ADDRESS } from '@safe-global/protocol-kit/dist/src/utils/constants'
import { useGetChainsConfigQuery } from '@safe-global/store/gateway'
import type { Balance } from '@safe-global/store/gateway/AUTO_GENERATED/balances'
import type { Chain } from '@safe-global/store/gateway/AUTO_GENERATED/chains'
import { checksumAddress, sameAddress } from '@safe-global/utils/utils/addresses'
import type { JsonRpcProvider } from 'ethers'
import { useEffect, useMemo, useRef } from 'react'
import chains from '@/config/chains'
import useAddressBook from '@/hooks/useAddressBook'
import useChainId from '@/hooks/useChainId'
import { useVisibleBalances } from '@/hooks/useVisibleBalances'
import { createWeb3ReadOnly } from '@/hooks/wallets/web3'
import { useWeb3ReadOnly } from '@/hooks/wallets/web3ReadOnly'
import { lookupAddress } from '@/services/ens'
import { getERC20TokenInfoOnChain } from '@/utils/tokens'
import { getOrCreate, withTimeout } from './promiseCache'

export const CLEAR_SIGNING_ETH_PLACEHOLDER = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'

export const isClearSigningNativeTokenAddress = (tokenAddress: string): boolean => {
  const normalized = tokenAddress.toLowerCase()
  return sameAddress(normalized, ZERO_ADDRESS) || normalized === CLEAR_SIGNING_ETH_PLACEHOLDER
}

const toTokenResult = ({ name, symbol, decimals }: TokenResult): TokenResult => ({ name, symbol, decimals })

export const resolveClearSigningChainInfo = (
  chainId: number,
  getChain: (chainId: number) => Chain | undefined,
): ChainInfoResult | null => {
  const chain = getChain(chainId)
  if (!chain) {
    return null
  }

  return {
    name: chain.chainName,
    nativeCurrency: toTokenResult(chain.nativeCurrency),
  }
}

interface ResolveClearSigningTokenParams {
  chainId: number
  tokenAddress: string
  currentChainId: string
  balanceItems: Balance[]
  getChain: (chainId: number) => Chain | undefined
  fetchErc20OnChain: (address: string) => Promise<{ symbol: string; decimals: number } | undefined>
}

export const resolveClearSigningToken = async ({
  chainId,
  tokenAddress,
  currentChainId,
  balanceItems,
  getChain,
  fetchErc20OnChain,
}: ResolveClearSigningTokenParams): Promise<TokenResult | null> => {
  if (isClearSigningNativeTokenAddress(tokenAddress)) {
    const chain = getChain(chainId)
    return chain ? toTokenResult(chain.nativeCurrency) : null
  }

  if (chainId !== Number(currentChainId)) {
    return null
  }

  const balanceItem = balanceItems.find((item) => sameAddress(item.tokenInfo.address, tokenAddress))
  if (balanceItem) {
    return toTokenResult(balanceItem.tokenInfo)
  }

  const onChain = await fetchErc20OnChain(tokenAddress)
  if (!onChain) {
    return null
  }

  return {
    name: onChain.symbol,
    symbol: onChain.symbol,
    decimals: onChain.decimals,
  }
}

interface SafeExternalDataProviderDeps {
  lookupAddressBook: (address: string) => string | undefined
  resolveEns: (address: string) => Promise<string | undefined>
  getChainInfo: (chainId: number) => Promise<ChainInfoResult | null>
  getTokenInfo: (chainId: number, tokenAddress: string) => Promise<TokenResult | null>
  chainClient: ChainClient
}

const toAddressName = (name: string): AddressNameResult => ({ name, typeMatch: true })

const createSafeExternalDataProvider = (deps: SafeExternalDataProviderDeps): ExternalDataProvider => ({
  resolveLocalName: async (address: string) => {
    const name = deps.lookupAddressBook(address)
    return name ? toAddressName(name) : null
  },
  resolveEnsName: async (address: string) => {
    const name = await deps.resolveEns(address)
    return name ? toAddressName(name) : null
  },
  resolveChainInfo: (chainId: number) => deps.getChainInfo(chainId),
  resolveToken: (chainId: number, tokenAddress: string) => deps.getTokenInfo(chainId, tokenAddress),
  chainClient: deps.chainClient,
})

const getChainFromConfig = (config: EntityState<Chain, string> | undefined, chainId: number): Chain | undefined =>
  config?.entities[String(chainId)]

export const REVOCATION_CALL_TIMEOUT_MS = 10_000

export const createMainnetChainClient = (
  getChainsConfig: () => EntityState<Chain, string> | undefined,
  createProvider: (chain: Chain) => Pick<JsonRpcProvider, 'call'> | undefined = createWeb3ReadOnly,
): ChainClient => {
  const mainnet = Number(chains.eth)
  let cached: { chain: Chain; provider: Pick<JsonRpcProvider, 'call'> | undefined } | undefined

  const getProvider = (chain: Chain) => {
    if (cached?.chain !== chain) {
      cached = { chain, provider: createProvider(chain) }
    }
    return cached.provider
  }

  return {
    call: async (chainId, { to, data }) => {
      if (chainId !== mainnet) {
        throw new Error(`ERC-8176 revocation state is only read on Ethereum mainnet, not chain ${chainId}`)
      }
      const chain = getChainFromConfig(getChainsConfig(), mainnet)
      const provider = chain && getProvider(chain)
      if (!provider) {
        throw new Error('No RPC provider for Ethereum mainnet; ERC-8176 revocation state cannot be read')
      }
      return withTimeout(
        provider.call({ to, data }),
        REVOCATION_CALL_TIMEOUT_MS,
        `ERC-8176 revocation check timed out after ${REVOCATION_CALL_TIMEOUT_MS}ms`,
      )
    },
  }
}

export const useClearSigningExternalDataProvider = (): ExternalDataProvider => {
  const chainId = useChainId()
  const addressBook = useAddressBook(chainId)
  const { balances } = useVisibleBalances()
  const ethersProvider = useWeb3ReadOnly()
  const { data: chainsConfig } = useGetChainsConfigQuery()

  const externalDataRef = useRef({ addressBook, balances, chainId, ethersProvider, chainsConfig })
  useEffect(() => {
    externalDataRef.current = { addressBook, balances, chainId, ethersProvider, chainsConfig }
  }, [addressBook, balances, chainId, ethersProvider, chainsConfig])

  const tokenCacheRef = useRef(new Map<string, Promise<TokenResult | null>>())

  return useMemo(
    () =>
      createSafeExternalDataProvider({
        lookupAddressBook: (address) => externalDataRef.current.addressBook[checksumAddress(address)],
        resolveEns: async (address) => {
          const provider = externalDataRef.current.ethersProvider
          if (!provider) {
            return undefined
          }
          return lookupAddress(provider, address)
        },
        getChainInfo: async (requestedChainId) => {
          const { chainsConfig: config } = externalDataRef.current
          return resolveClearSigningChainInfo(requestedChainId, (id) => getChainFromConfig(config, id))
        },
        getTokenInfo: (tokenChainId, tokenAddress) =>
          getOrCreate(tokenCacheRef.current, `${tokenChainId}:${tokenAddress.toLowerCase()}`, () => {
            const { chainId: currentChainId, balances: currentBalances, chainsConfig: config } = externalDataRef.current

            return resolveClearSigningToken({
              chainId: tokenChainId,
              tokenAddress,
              currentChainId,
              balanceItems: currentBalances.items,
              getChain: (id) => getChainFromConfig(config, id),
              fetchErc20OnChain: async (address) => {
                const infos = await getERC20TokenInfoOnChain(address)
                const info = infos?.[0]
                if (!info) {
                  return undefined
                }
                return { symbol: info.symbol, decimals: info.decimals }
              },
            })
          }),
        chainClient: createMainnetChainClient(() => externalDataRef.current.chainsConfig),
      }),
    [],
  )
}
