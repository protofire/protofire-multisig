import { useEffect } from 'react'
import type { NextPage } from 'next'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { Container } from '@mui/material'
import { BRAND_NAME } from '@/config/constants'
import { AppRoutes } from '@/config/routes'
import { isValidMigrationSource } from '@/config/dataMigration'
import useChains from '@/hooks/useChains'
import { DataMigrationFeature } from '@/features/data-migration'
import { useLoadFeature } from '@/features/__core__'

const MigratePage: NextPage = () => {
  const router = useRouter()
  const migration = useLoadFeature(DataMigrationFeature)
  const { configs, isRuntimeData } = useChains()

  const source = typeof router.query.source === 'string' ? router.query.source : undefined
  // The actual migration payload arrives via URL fragment (read directly by
  // MigrationHandshake) - `source` only gates whether this landing page renders at all.
  const hasValidSource = isValidMigrationSource(source, configs)

  useEffect(() => {
    // The build-time chains snapshot may lag the gateway, so only reject an unknown
    // source once the runtime chain configs have settled.
    if (router.isReady && isRuntimeData && !hasValidSource) {
      router.replace(AppRoutes['404'])
    }
  }, [router, hasValidSource, isRuntimeData])

  return (
    <>
      <Head>
        <title>{`${BRAND_NAME} – Move your data`}</title>
      </Head>

      {router.isReady && hasValidSource && (
        <Container maxWidth="sm" sx={{ py: 6 }}>
          <migration.MigrationHandshake />
        </Container>
      )}
    </>
  )
}

export default MigratePage
