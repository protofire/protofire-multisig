import { useEffect } from 'react'
import type { NextPage } from 'next'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { BRAND_NAME } from '@/config/constants'
import { AppRoutes } from '@/config/routes'
import { useIsProtofireHost } from '@/hooks/useIsProtofireHost'
import SuperchainMigration from '@/components/superchain-migration'

const SuperchainMigrationPage: NextPage = () => {
  const router = useRouter()
  const isProtofireHost = useIsProtofireHost()

  useEffect(() => {
    if (isProtofireHost === false) {
      router.replace(AppRoutes['404'])
    }
  }, [isProtofireHost, router])

  return (
    <>
      <Head>
        <title>{`${BRAND_NAME} – Superchain migration`}</title>
      </Head>

      {isProtofireHost === true && <SuperchainMigration />}
    </>
  )
}

export default SuperchainMigrationPage
