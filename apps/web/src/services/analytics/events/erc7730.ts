import type { AnalyticsEvent } from '../types'

export const ERC7730_CATEGORY = 'erc7730'

export const ERC7730_EVENTS = {
  LOOKUP_REQUESTED: {
    action: 'ERC-7730 lookup requested',
    category: ERC7730_CATEGORY,
  },
  LOOKUP_RESULT: {
    action: 'ERC-7730 lookup result',
    category: ERC7730_CATEGORY,
  },
  SOURCE_LINK_CLICKED: {
    action: 'ERC-7730 source link clicked',
    category: ERC7730_CATEGORY,
  },
} as const satisfies Record<string, AnalyticsEvent>
