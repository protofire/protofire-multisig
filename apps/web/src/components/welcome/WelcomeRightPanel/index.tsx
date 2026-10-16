import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded'
import { TALK_TO_US_URL } from '@/config/constants.extra'
import useChains from '@/hooks/useChains'
import ExternalLink from '@/components/common/ExternalLink'
import NetworkCarousel from './NetworkCarousel'
import css from './styles.module.css'
import { formatNetworkCountLabel } from './utils'

const FEATURES = ['Non-custodial', 'Built on Safe protocol']

const WelcomeRightPanel = () => {
  const { configs, loading } = useChains()
  const networkCountLabel = formatNetworkCountLabel(configs.length)

  return (
    <section className={css.panel} data-testid="welcome-right-panel">
      <div className={css.main}>
        <div className={css.hero}>
          <p className={css.label}>For organizations and power users</p>
          <h2 className={css.title}>Own your assets onchain securely</h2>
          <ul className={css.featureList}>
            {[...FEATURES, networkCountLabel].map((label) => (
              <li key={label} className={css.featureItem}>
                {label}
              </li>
            ))}
          </ul>
        </div>

        <div className={css.spacer} />

        <div className={css.networks}>
          <NetworkCarousel chains={configs} loading={loading} />
        </div>
      </div>

      <div className={css.footer}>
        <ExternalLink href={TALK_TO_US_URL} noIcon className={css.talkToUsLink} data-testid="welcome-talk-to-us">
          Talk to us
          <ArrowForwardRoundedIcon className={css.talkToUsArrow} fontSize="inherit" />
        </ExternalLink>
        <p className={css.talkToUsDescription}>
          For technical teams evaluating Protofire as a multisig infrastructure provider.
        </p>
      </div>
    </section>
  )
}

export default WelcomeRightPanel
