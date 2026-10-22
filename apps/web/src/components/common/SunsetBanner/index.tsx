import { type ReactElement } from 'react'
import { Typography } from '@mui/material'
import classnames from 'classnames'
import ErrorMessage from '@/components/tx/ErrorMessage'
import useChainId from '@/hooks/useChainId'
import { useHasFeature } from '@/hooks/useChains'
import { FEATURES } from '@safe-global/utils/utils/chains'
import { SUNSET_BANNERS } from './config'
import { getActiveBanner, interpolateDeadline } from './utils'
import { renderMarkup } from './markup'
import css from './style.module.css'

const SunsetBanner = ({ className }: { className?: string }): ReactElement | null => {
  const chainId = useChainId()
  const isSunsetBannerEnabled = useHasFeature(FEATURES.SUNSET_BANNER)
  const banner = getActiveBanner(SUNSET_BANNERS, chainId)

  if (!isSunsetBannerEnabled || !banner) return null

  return (
    <div className={classnames(css.wrapper, className)}>
      <ErrorMessage level={banner.severity ?? 'warning'} title={banner.title}>
        <Typography variant="body2">{renderMarkup(interpolateDeadline(banner))}</Typography>
      </ErrorMessage>
    </div>
  )
}

export default SunsetBanner
