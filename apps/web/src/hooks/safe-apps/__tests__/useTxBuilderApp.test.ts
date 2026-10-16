import { useRouter } from 'next/router'
import type { SafeApp } from '@safe-global/store/gateway/AUTO_GENERATED/safe-apps'

import * as useRemoteSafeAppsHook from '@/hooks/safe-apps/useRemoteSafeApps'
import { useTxBuilderApp } from '@/hooks/safe-apps/useTxBuilderApp'
import { AppRoutes } from '@/config/routes'
import { renderHook } from '@/tests/test-utils'

jest.mock('next/router', () => ({
  useRouter: jest.fn(),
}))

describe('useTxBuilderApp', () => {
  const SAFE = 'trx-shasta:0xD72c8d27d0F45173d3178E35B2d496F56a407fF7'

  beforeEach(() => {
    jest.clearAllMocks()
    ;(useRouter as jest.Mock).mockReturnValue({ query: { safe: SAFE } })
  })

  it('should use the registered Transaction Builder url from the config service', () => {
    jest.spyOn(useRemoteSafeAppsHook, 'useRemoteSafeApps').mockReturnValue([
      [
        {
          name: 'Transaction Builder',
          url: 'https://dev-tron-apps.safe.protofire.io/tx-builder',
        } as unknown as SafeApp,
      ],
      undefined,
      false,
    ])

    const { result } = renderHook(() => useTxBuilderApp())

    expect(result.current.link).toEqual({
      pathname: AppRoutes.apps.open,
      query: { safe: SAFE, appUrl: 'https://dev-tron-apps.safe.protofire.io/tx-builder' },
    })
  })

  it('should fall back to the default url while the remote list is unavailable', () => {
    jest.spyOn(useRemoteSafeAppsHook, 'useRemoteSafeApps').mockReturnValue([undefined, undefined, true])

    const { result } = renderHook(() => useTxBuilderApp())

    expect(result.current.link.query).toEqual({
      safe: SAFE,
      appUrl: 'https://dev-apps.safe.protofire.io/tx-builder',
    })
  })
})
