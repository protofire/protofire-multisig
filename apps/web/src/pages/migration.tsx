import { useEffect, useMemo } from 'react'
import type { NextPage } from 'next'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { BRAND_NAME } from '@/config/constants'
import { AppRoutes } from '@/config/routes'
import { useIsProtofireHost } from '@/hooks/useIsProtofireHost'
import Migration from '@/components/migration'
import { parseMigrationParams } from '@/components/migration/parseMigrationParams'

const MigrationPage: NextPage = () => {
  const router = useRouter()
  const isProtofireHost = useIsProtofireHost()

  const params = useMemo(() => parseMigrationParams(router.query), [router.query])

  useEffect(() => {
    if (isProtofireHost === false) {
      router.replace(AppRoutes['404'])
    }
  }, [isProtofireHost, router])

  return (
    <>
      <Head>
        <title>{`${BRAND_NAME} – Migration`}</title>
      </Head>

      {isProtofireHost === true && router.isReady && <Migration params={params} />}
    </>
  )
}

export default MigrationPage
