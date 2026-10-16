import type { FeatureHandle } from '@/features/__core__'
import type { DataMigrationContract } from './contract'

/**
 * Unlike most features, this isn't gated by a chain-config flag. `/migrate` is a
 * standalone landing page reached with no Safe/chain selected, so useHasFeature would
 * resolve DATA_MIGRATION_PROMO against whatever chain useChainId() falls back to
 * (never the chain implied by `source`) and permanently disable the page. Gating instead
 * happens on a valid `source` (a gateway chain short name) in the /migrate page.
 */
export const DataMigrationFeature: FeatureHandle<DataMigrationContract> = {
  name: 'data-migration',
  useIsEnabled: () => true,
  load: () => import(/* webpackMode: "lazy" */ './feature') as Promise<{ default: DataMigrationContract }>,
}

export type { DataMigrationContract } from './contract'
