import React from 'react'
import { useRouter } from 'next/router'
import css from './styles.module.css'
import WelcomeLogin from './WelcomeLogin'
import WelcomeRightPanel from './WelcomeRightPanel'
import SafeLogo from '@/public/images/logo.svg'
import footerCss from './welcomeFooter.module.css'
import Footer from '../common/Footer'
import { AppRoutes } from '@/config/routes'
import SunsetBanner from '../common/SunsetBanner'
import WelcomeDisclaimer from './WelcomeDisclaimer'
import WelcomeGreetingDialog from './WelcomeGreetingDialog'

const welcomeLogoStyle: React.CSSProperties = { display: 'block', width: '180px', height: '60px' }

const NewSafe = () => {
  const router = useRouter()
  const isGreetingOpen = router.isReady && router.pathname === AppRoutes.welcome.dataMigration

  const handleCloseGreeting = () => {
    router.replace({ pathname: AppRoutes.welcome.index, query: router.query }, undefined, { shallow: true })
  }

  return (
    <div className={css.loginPage}>
      <div className={css.leftSide}>
        <div className={css.logoContainer}>
          <SafeLogo className={css.logo} style={welcomeLogoStyle} />
        </div>
        <SunsetBanner className={css.welcomeBanner} />
        <div className={css.loginContainer}>
          <WelcomeLogin />
        </div>
        <div className={css.welcomeFooterSection}>
          <Footer forceShow versionIcon={false} helpCenter={false} preferences={false} className={footerCss.footer} />
          <WelcomeDisclaimer />
        </div>
      </div>

      <div className={css.rightSide}>
        <WelcomeRightPanel />
      </div>

      <WelcomeGreetingDialog open={isGreetingOpen} onClose={handleCloseGreeting} />
    </div>
  )
}

export default NewSafe
