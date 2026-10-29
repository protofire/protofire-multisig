import CustomLink from '@/components/common/CustomLink'
import type { MDXComponents } from 'mdx/types'
import type { NextPage } from 'next'
import Head from 'next/head'
import { useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { Typography } from '@mui/material'
import SafePrivacyPolicy from '@/markdown/privacy/privacy.md'
import { useIsOfficialHost } from '@/hooks/useIsOfficialHost'
import { BRAND_NAME } from '@/config/constants'
import { PRIVACY_POLICY_LINK } from '@/config/constants.extra'

const overrideComponents: MDXComponents = {
  a: CustomLink,
}

const PrivacyPolicy: NextPage = () => {
  const isOfficialHost = useIsOfficialHost()
  const [content, setContent] = useState<string>('')

  useEffect(() => {
    const fetchContent = async () => {
      try {
        const response = await fetch(PRIVACY_POLICY_LINK)
        const text = await response.text()
        setContent(text.replace(/\${origin}/g, window.location.origin))
      } catch (error) {
        console.error('Error fetching privacy policy:', error)
      }
    }

    fetchContent()
  }, [])

  return (
    <>
      <Head>
        <title>{`${BRAND_NAME} – Privacy Policy`}</title>
      </Head>

      <main style={{ lineHeight: '1.5' }}>
        {isOfficialHost ? (
          <SafePrivacyPolicy components={overrideComponents} />
        ) : (
          <>{content ? <ReactMarkdown>{content}</ReactMarkdown> : <Typography>Loading privacy policy...</Typography>}</>
        )}
      </main>
    </>
  )
}

export default PrivacyPolicy
