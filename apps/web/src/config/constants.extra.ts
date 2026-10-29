export const NEW_SUGGESTION_FORM = 'https://safe-feature-request.protofire.io'
export const TALK_TO_US_URL = process.env.NEXT_PUBLIC_TALK_TO_US_URL || 'https://calendly.com/margaret-ap/30-min'
export const TERMS_LINK =
  process.env.NEXT_PUBLIC_TERMS_LINK ||
  'https://raw.githubusercontent.com/protofire/safe-legal/refs/heads/main/terms.md'
export const COOKIE_LINK =
  process.env.NEXT_PUBLIC_COOKIE_LINK ||
  'https://raw.githubusercontent.com/protofire/safe-legal/refs/heads/main/cookie.md'
export const PRIVACY_POLICY_LINK =
  process.env.NEXT_PUBLIC_PRIVACY_POLICY_LINK ||
  'https://raw.githubusercontent.com/protofire/safe-legal/refs/heads/main/privacy.md'

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

export const ERC8176_TRUSTED_ATTESTERS = (
  process.env.NEXT_PUBLIC_ERC8176_TRUSTED_ATTESTERS || '0x3846c3A30E62075Fa916216b35EF04B8F53931f6'
)
  .split(',')
  .map((address) => address.trim())
  .filter(Boolean)
