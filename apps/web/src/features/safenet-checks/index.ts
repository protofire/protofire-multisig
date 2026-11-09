import { createFeatureHandle } from '@/features/__core__'
import type { SafenetChecksContract } from './contract'

export const SafenetChecksFeature = createFeatureHandle<SafenetChecksContract>('safenet-checks')

export type { SafenetChecksContract } from './contract'

export { useRequestSafenetCheck } from './hooks/useRequestSafenetCheck'
export { getStatusCopy, type StatusCopy } from './statusCopy'
