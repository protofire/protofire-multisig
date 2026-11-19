import type { ReactElement } from 'react'
import { Button, Typography } from '@mui/material'
import classnames from 'classnames'
import ErrorMessage from '@/components/tx/ErrorMessage'
import { DATA_MIGRATION_BANNER } from '@/config/dataMigration'
import css from './style.module.css'

const DataMigrationBannerView = ({ href, className }: { href: string; className?: string }): ReactElement => (
  <div className={classnames(css.wrapper, className)}>
    <ErrorMessage level="info" title={DATA_MIGRATION_BANNER.title}>
      <Typography variant="body2" mb={1}>
        {DATA_MIGRATION_BANNER.description}
      </Typography>
      <Button data-testid="data-migration-cta" variant="contained" size="small" href={href}>
        {DATA_MIGRATION_BANNER.cta}
      </Button>
    </ErrorMessage>
  </div>
)

export default DataMigrationBannerView
