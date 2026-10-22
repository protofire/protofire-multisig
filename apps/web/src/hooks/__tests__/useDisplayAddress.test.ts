import { renderHook } from '@/tests/test-utils'
import useDisplayAddress from '@/hooks/useDisplayAddress'
import * as useTronAddressHook from '@/hooks/useTronAddress'
import * as useRootstockAddressHook from '@/hooks/useRootstockAddress'

const ADDRESS = '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed'
const RSK_ADDRESS = '0x5aaEB6053f3e94c9b9a09f33669435E7ef1bEAeD'
const TRON_ADDRESS = 'TB2c4z3BMsxhY6EsmkqcktUuonyVYXWFhC'

const tronResult = (isTron: boolean) => ({
  displayAddress: isTron ? TRON_ADDRESS : ADDRESS,
  shortAddress: ADDRESS,
  copyAddress: isTron ? TRON_ADDRESS : ADDRESS,
  isTron,
})

describe('useDisplayAddress', () => {
  beforeEach(() => {
    jest.restoreAllMocks()
    jest.spyOn(useRootstockAddressHook, 'default').mockReturnValue(RSK_ADDRESS)
    jest
      .spyOn(useRootstockAddressHook, 'useRootstockCopyAddressFormatter')
      .mockReturnValue((value) => value.toLowerCase())
  })

  it('prefers the Tron format on Tron chains', () => {
    jest.spyOn(useTronAddressHook, 'default').mockReturnValue(tronResult(true))

    const { result } = renderHook(() => useDisplayAddress(ADDRESS))

    expect(result.current).toEqual({ displayAddress: TRON_ADDRESS, copyAddress: TRON_ADDRESS, isTron: true })
  })

  it('displays the Rootstock format and copies the lower-case address on other chains', () => {
    jest.spyOn(useTronAddressHook, 'default').mockReturnValue(tronResult(false))

    const { result } = renderHook(() => useDisplayAddress(ADDRESS))

    expect(result.current).toEqual({
      displayAddress: RSK_ADDRESS,
      copyAddress: ADDRESS.toLowerCase(),
      isTron: false,
    })
  })

  it('keeps the EVM address when requested', () => {
    jest.spyOn(useTronAddressHook, 'default').mockReturnValue(tronResult(false))

    const { result } = renderHook(() => useDisplayAddress(ADDRESS, undefined, { keepEvm: true }))

    expect(result.current).toEqual({ displayAddress: ADDRESS, copyAddress: ADDRESS, isTron: false })
  })
})
