import { Chip } from '@/components/common/Chip'
import { FEATURES, hasFeature } from '@safe-global/utils/utils/chains'
import type { Chain } from '@safe-global/store/gateway/AUTO_GENERATED/chains'
import type { ReactElement } from 'react'

const NewNetworkChip = ({ chain }: { chain: Pick<Chain, 'features'> }): ReactElement | null => {
  if (!hasFeature(chain, FEATURES.NEW_NETWORK)) return null

  return <Chip sx={{ ml: 'auto', flexShrink: 0 }} />
}

export default NewNetworkChip
