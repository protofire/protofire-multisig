import ExternalLink from '@/components/common/ExternalLink'
import type { ReactNode } from 'react'

export const NEW_SUGGESTION_FORM = 'https://safe-feature-request.protofire.io'
export const TALK_TO_US_URL = process.env.NEXT_PUBLIC_TALK_TO_US_URL || 'https://calendly.com/margaret-ap/30-min'
export const TERMS_LINK =
  process.env.NEXT_PUBLIC_TERMS_LINK ||
  'https://raw.githubusercontent.com/protofire/safe-legal/refs/heads/main/terms.md'
export const COOKIE_LINK =
  process.env.NEXT_PUBLIC_COOKIE_LINK ||
  'https://raw.githubusercontent.com/protofire/safe-legal/refs/heads/main/cookie.md'

export const PROTOFIRE_SUPPORT_LINK = 'https://safe-support.protofire.io'

export const IMPRINT_LINK =
  process.env.NEXT_PUBLIC_IMPRINT_LINK ||
  'https://raw.githubusercontent.com/protofire/safe-legal/refs/heads/main/imprint.md'

export const LIFI_WIDGET_URL = process.env.NEXT_PUBLIC_LIFI_WIDGET_URL || 'https://lifi-swap.safe.protofire.io/'
export const LIFI_INTEGRATOR_ID = 'protofire-safe'

export const OZ_SAFE_UTILS_URL = 'https://safeutils.openzeppelin.com'
export const PROTOFIRE_SAFE_UTILS_URL = 'https://safeutils.protofire.io'

export const ERC7730_REGISTRY_URL = (
  process.env.NEXT_PUBLIC_ERC7730_REGISTRY_URL ||
  'https://raw.githubusercontent.com/protofire/clear-signing-erc7730-registry/refs/heads/protofire'
).replace(/\/+$/, '')

export const ERC7730_REGISTRY_SOURCE_BLOB_BASE =
  'https://github.com/protofire/clear-signing-erc7730-registry/blob/protofire'

// Sunset banners per chain ID
const CROSSFI_SUNSET_BANNER = {
  title: 'CrossFi Safe Support Sunsetting',
  description:
    'Dear users, Support for Safe on CrossFi will end soon. Please withdraw your funds until April 17, 2029.',
}
const MANTRA_SUNSET_BANNER = {
  title: 'Mantra is moving to a dedicated Safe instance',
  description: (
    <>
      Dear users, support for <b>Mantra Mainnet</b> is moving to the dedicated Safe instance:{' '}
      <ExternalLink href="https://safe.mantracha.in">https://safe.mantracha.in</ExternalLink>
      <br />
      To transfer your local Safe settings, please use <b>Settings → Data Export</b> in the current interface.
    </>
  ),
}
const TAIKO_SUNSET_BANNER = {
  title: 'Taiko Safe is merging with Protofire Safe!',
  description: (
    <>
      Your Safes and transaction history are already accessible at{' '}
      <ExternalLink href="https://app.safe.protofire.io">Protofire Safe</ExternalLink>. Export your local data via{' '}
      <b>Settings → Data</b> (added Safes, address book, settings, etc.). Taiko Safe will be running until July 31,
      2026.
    </>
  ),
}
const EDU_CHAIN_SUNSET_BANNER = {
  title: 'EDU Chain Safe is merging with Protofire Safe!',
  description: (
    <>
      Your Safes and transaction history are already accessible at{' '}
      <ExternalLink href="https://app.safe.protofire.io">Protofire Safe</ExternalLink>. Export your local data via{' '}
      <b>Settings → Data</b> (added Safes, address book, settings, etc.), and finalize any open transactions before
      August 15.
    </>
  ),
}

export const SUNSET_BANNERS: Record<string, { title: string; description: string | ReactNode }> = {
  '4158': CROSSFI_SUNSET_BANNER,
  '4157': CROSSFI_SUNSET_BANNER,
  '5887': MANTRA_SUNSET_BANNER,
  '5888': MANTRA_SUNSET_BANNER,
  '167000': TAIKO_SUNSET_BANNER,
  '167013': TAIKO_SUNSET_BANNER,
  '41923': EDU_CHAIN_SUNSET_BANNER,
  '656476': EDU_CHAIN_SUNSET_BANNER,
}
