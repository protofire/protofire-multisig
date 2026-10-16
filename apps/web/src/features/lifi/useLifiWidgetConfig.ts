import { useMemo } from 'react'
import { useDarkMode } from '@/hooks/useDarkMode'
import useChainId from '@/hooks/useChainId'
import { LIFI_INTEGRATOR_ID } from '@/config/constants.extra'
import type { SplitSubvariant, WidgetConfig } from './types/widget'

export type LifiWidgetMode = SplitSubvariant

const BASE_CONFIG: WidgetConfig = {
  integrator: LIFI_INTEGRATOR_ID,
  fee: 0.005,
  variant: 'compact',
  subvariant: 'split',
  theme: {
    shape: {
      borderRadius: 15,
    },
    container: {
      boxShadow: '0px 8px 32px rgba(0, 0, 0, 0.08)',
      borderRadius: '16px',
      maxHeight: '96vh',
    },
  },
  hiddenUI: ['walletMenu'],
}

// The Safe connector cannot switch chains mid-route, so bridging must not ask for it
const MODE_CONFIG: Record<LifiWidgetMode, (fromChain: number) => Partial<WidgetConfig>> = {
  swap: (fromChain) => ({ toChain: fromChain }),
  bridge: () => ({ sdkConfig: { routeOptions: { allowSwitchChain: false } } }),
}

export const getLifiWidgetConfig = (
  mode: LifiWidgetMode,
  chainId: string,
  isDarkMode: boolean,
  fromToken?: string,
): WidgetConfig => {
  const fromChain = Number(chainId)

  return {
    ...BASE_CONFIG,
    // The widget routes pin the mode; this only matters for the single-route 3.11 build
    subvariantOptions: { split: mode },
    appearance: isDarkMode ? 'dark' : 'light',
    fromChain,
    chains: { from: { allow: [fromChain] } },
    ...(fromToken ? { fromToken } : {}),
    ...MODE_CONFIG[mode](fromChain),
  }
}

export const useLifiWidgetConfig = (mode: LifiWidgetMode, fromToken?: string): WidgetConfig => {
  const isDarkMode = useDarkMode()
  const chainId = useChainId()

  return useMemo(
    () => getLifiWidgetConfig(mode, chainId, isDarkMode, fromToken),
    [mode, chainId, isDarkMode, fromToken],
  )
}
