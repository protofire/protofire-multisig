import { useChain, useCurrentChain } from '@/hooks/useChains'
import useSafeAddress from '@/hooks/useSafeAddress'
import { useCallback, useEffect, type ReactElement } from 'react'
import type { Chain } from '@safe-global/store/gateway/AUTO_GENERATED/chains'
import { Controller, useFormContext, useWatch } from 'react-hook-form'
import useWallet from '@/hooks/wallets/useWallet'
import { isTronChain } from '@/utils/tron-chains'
import { isTronWallet } from '@/utils/wallets'
import { useRouter } from 'next/router'
import { getNetworkLink } from '@/components/common/NetworkSelector'
import { SetNameStepFields } from '@/components/new-safe/create/steps/SetNameStep'
import { getSafeSingletonDeployments, getSafeToL2SetupDeployments } from '@safe-global/safe-deployments'
import { hasCanonicalDeployment } from '@safe-global/utils/services/contracts/deployments'
import { hasMultiChainCreationFeatures } from '../../utils'
import { getLatestSafeVersion } from '@safe-global/utils/utils/chains'
import NetworkMultiSelectorInput from '@/components/common/NetworkSelector/NetworkMultiSelectorInput'

const SafeCreationNetworkInput = ({
  name,
  isAdvancedFlow = false,
}: {
  name: string
  isAdvancedFlow?: boolean
}): ReactElement => {
  const router = useRouter()
  const safeAddress = useSafeAddress()
  const currentChain = useCurrentChain()
  const wallet = useWallet()
  const walletChain = useChain(wallet?.chainId || '')

  const {
    formState: { errors },
    control,
    setValue,
  } = useFormContext()

  // MetaMask & co. can't create on Tron and TronLink can't create on EVM chains
  const isWalletFamily = useCallback(
    (network: Chain) => !wallet || isTronChain(network.chainId) === isTronWallet(wallet),
    [wallet],
  )
  const getOptionNote = useCallback(
    (network: Chain) => {
      if (isWalletFamily(network)) return
      return isTronChain(network.chainId) ? 'Needs TronLink' : 'Needs an EVM wallet'
    },
    [isWalletFamily],
  )

  const selectedNetworks: Chain[] = useWatch({ control, name: SetNameStepFields.networks })

  const updateCurrentNetwork = useCallback(
    (chains: Chain[]) => {
      if (chains.length !== 1) return
      const networkLink = getNetworkLink(router, safeAddress, chains[0])
      router.replace(networkLink)
    },
    [router, safeAddress],
  )

  const isOptionDisabled = useCallback(
    (optionNetwork: Chain) => {
      if (!isWalletFamily(optionNetwork)) return true

      // Initially all networks are always available
      if (selectedNetworks.length === 0) {
        return false
      }

      const firstSelectedNetwork = selectedNetworks[0]

      // do not allow multi chain safes for advanced setup flow.
      if (isAdvancedFlow) return optionNetwork.chainId != firstSelectedNetwork.chainId

      // Check required feature toggles
      const optionIsSelectedNetwork = firstSelectedNetwork.chainId === optionNetwork.chainId
      if (!hasMultiChainCreationFeatures(optionNetwork) || !hasMultiChainCreationFeatures(firstSelectedNetwork)) {
        return !optionIsSelectedNetwork
      }

      // Check if required deployments are available
      const optionHasCanonicalSingletonDeployment =
        hasCanonicalDeployment(
          getSafeSingletonDeployments({
            network: optionNetwork.chainId,
            version: getLatestSafeVersion(firstSelectedNetwork),
          }),
          optionNetwork.chainId,
        ) &&
        hasCanonicalDeployment(
          getSafeToL2SetupDeployments({ network: optionNetwork.chainId, version: '1.4.1' }),
          optionNetwork.chainId,
        )

      const selectedHasCanonicalSingletonDeployment =
        hasCanonicalDeployment(
          getSafeSingletonDeployments({
            network: firstSelectedNetwork.chainId,
            version: getLatestSafeVersion(firstSelectedNetwork),
          }),
          firstSelectedNetwork.chainId,
        ) &&
        hasCanonicalDeployment(
          getSafeToL2SetupDeployments({ network: firstSelectedNetwork.chainId, version: '1.4.1' }),
          firstSelectedNetwork.chainId,
        )

      // Only 1.4.1 safes with canonical deployment addresses and SafeToL2Setup can be deployed as part of a multichain group
      if (!selectedHasCanonicalSingletonDeployment) return !optionIsSelectedNetwork
      return !optionHasCanonicalSingletonDeployment
    },
    [isAdvancedFlow, selectedNetworks, isWalletFamily],
  )

  // After switching to a wallet of the other family, start over from the wallet's own network
  useEffect(() => {
    if (selectedNetworks.some((network) => !isWalletFamily(network))) {
      setValue(name, walletChain ? [walletChain] : [], { shouldValidate: true })
    }
  }, [selectedNetworks, isWalletFamily, walletChain, name, setValue])

  useEffect(() => {
    if (
      selectedNetworks.length === 1 &&
      selectedNetworks[0].chainId !== currentChain?.chainId &&
      isWalletFamily(selectedNetworks[0])
    ) {
      updateCurrentNetwork([selectedNetworks[0]])
    }
  }, [selectedNetworks, currentChain, updateCurrentNetwork, isWalletFamily])

  return (
    <>
      <Controller
        name={name}
        control={control}
        defaultValue={[]}
        render={({ field }) => (
          <NetworkMultiSelectorInput
            value={field.value || []}
            name={name}
            onNetworkChange={updateCurrentNetwork}
            isOptionDisabled={isOptionDisabled}
            getOptionNote={getOptionNote}
            placeholder="Type to search..."
            error={!!errors.networks}
            helperText={errors.networks ? 'Select at least one network' : ''}
          />
        )}
        rules={{ required: true }}
      />
    </>
  )
}

export default SafeCreationNetworkInput
