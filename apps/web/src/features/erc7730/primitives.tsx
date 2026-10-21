import { Typography } from '@mui/material'
import classnames from 'classnames'
import type { ReactElement, ReactNode } from 'react'
import css from './styles.module.css'

export const ClearSigningPill = ({
  children,
  testId,
  className,
}: {
  children: ReactNode
  testId?: string
  className?: string
}): ReactElement => (
  <Typography component="span" variant="body2" data-testid={testId} className={classnames(css.pill, className)}>
    {children}
  </Typography>
)

export const FieldGrid = ({ label, children }: { label: string; children: ReactNode }): ReactElement => (
  <div className={css.fieldGrid}>
    <Typography color="primary.light" variant="body2" component="span">
      {label}
    </Typography>
    {children}
  </div>
)
