import type { ReactElement } from 'react'
import { useRouter } from 'next/router'
import { useCurrentChain } from '@/hooks/useChains'
import useSafeAddress from '@/hooks/useSafeAddress'
import { AppRoutes } from '@/config/routes'
import { getProtofireMultisigSafeUrl, isDataMigrationBannerChain } from '@/config/dataMigration'
import DataMigrationBannerView from './DataMigrationBannerView'

const DataMigrationBanner = ({ className }: { className?: string }): ReactElement | null => {
  const chain = useCurrentChain()
  const router = useRouter()
  const safeAddress = useSafeAddress()

  const isDashboardWithSafe = router.pathname === AppRoutes.home && !!safeAddress

  if (!isDashboardWithSafe || !chain || !isDataMigrationBannerChain(chain.chainId)) return null

  return (
    <DataMigrationBannerView href={getProtofireMultisigSafeUrl(chain.shortName, safeAddress)} className={className} />
  )
}

export default DataMigrationBanner
