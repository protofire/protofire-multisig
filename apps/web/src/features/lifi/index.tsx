import css from './styles.module.css'
import useSwapConsent from './useSwapConsent'
import Disclaimer from '@/components/common/Disclaimer'
import WidgetDisclaimer from '@/components/common/WidgetDisclaimer'
import { LIFI_WIDGET_URL } from '@/config/constants.extra'
import { LifiWidgetFrame } from './components/LifiWidgetFrame'
import { useLifiWidgetConfig } from './useLifiWidgetConfig'

export { LifiWidgetFrame } from './components/LifiWidgetFrame'
export { useLifiWidgetConfig } from './useLifiWidgetConfig'
export type { LifiWidgetMode } from './useLifiWidgetConfig'

type Params = {
  sell?: {
    // The token address
    asset: string
    amount: string
  }
}

const LifiSwapWidget = ({ sell }: Params) => {
  const { isConsentAccepted, onAccept } = useSwapConsent()
  const config = useLifiWidgetConfig('swap', sell?.asset)

  if (!isConsentAccepted) {
    return (
      <Disclaimer
        title="Note"
        content={<WidgetDisclaimer widgetName="Lifi Widget" />}
        onAccept={onAccept}
        buttonText="Continue"
      />
    )
  }

  return <LifiWidgetFrame url={LIFI_WIDGET_URL} name="Swap" config={config} className={css.swapWidget} />
}

export default LifiSwapWidget
