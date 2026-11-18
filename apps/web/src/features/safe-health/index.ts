import { createFeatureHandle, type FeatureHandle } from '@/features/__core__'
import type { SafeHealthContract } from './contract'
import { useIsSafeHealthEnabled } from './hooks/useIsSafeHealthEnabled'

export const SafeHealthFeature: FeatureHandle<SafeHealthContract> = {
  ...createFeatureHandle<SafeHealthContract>('safe-health'),
  useIsEnabled: useIsSafeHealthEnabled,
}

export type { SafeHealthContract } from './contract'

export { useIsSafeHealthEnabled } from './hooks/useIsSafeHealthEnabled'
