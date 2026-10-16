import type { ReactElement } from 'react'
import { Typography } from '@mui/material'
import css from './styles.module.css'

const WelcomeDisclaimer = ({ className }: { className?: string }): ReactElement => (
  <div className={className ? `${css.disclaimer} ${className}` : css.disclaimer}>
    <Typography variant="caption" component="p" className={css.text}>
      Protofire Multisig is an independent interface built on the open-source Safe smart contracts. It is not a Safe
      product and is not endorsed or sponsored by Safe Ecosystem Foundation or Safe Labs. &ldquo;Safe&rdquo; is a
      trademark of its respective owner.
    </Typography>
  </div>
)

export default WelcomeDisclaimer
