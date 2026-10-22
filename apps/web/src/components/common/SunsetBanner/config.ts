import type { SunsetBannerConfig } from './types'

export const SUNSET_BANNERS = [
  {
    id: 'crossfi',
    chainIds: ['4157', '4158'],
    title: 'CrossFi Safe Support Sunsetting',
    description: 'Dear users, Support for Safe on CrossFi will end soon. Please withdraw your funds until {date}.',
    deadline: '2029-04-17',
  },
  {
    id: 'mantra',
    chainIds: ['5887', '5888'],
    title: 'Mantra is moving to a dedicated Safe instance',
    description:
      'Dear users, support for **Mantra Mainnet** is moving to the dedicated Safe instance: [https://safe.mantracha.in](https://safe.mantracha.in)\n' +
      'To transfer your local Safe settings, please use **Settings → Data Export** in the current interface.',
  },
  {
    id: 'lisk',
    chainIds: ['1135', '4202'],
    title: 'Lisk Support Sunsetting',
    description:
      'Dear users, Support for Lisk will end soon. Please withdraw your funds until {date}. ' +
      'For further details regarding the shutdown, please refer to [this page](https://support.lisk.com/faq/lisk-chain-closure).',
    deadline: '2026-10-30',
  },
  {
    id: 'blast',
    chainIds: ['81457', '168587773'],
    title: 'Blast Support Sunsetting',
    description:
      'Dear users, Support for Blast will end soon. Please withdraw your funds until {date}. ' +
      'For further details regarding the shutdown, please refer to [this page](https://x.com/blast/status/2106032805280891073). ' +
      'Withdraw to Ethereum [guide](https://x.com/blast/status/2110154434860679595)',
    deadline: '2026-10-26',
  },
] satisfies SunsetBannerConfig[]
