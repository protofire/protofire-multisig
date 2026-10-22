import * as addressBook from '@/hooks/useAddressBook'
import * as allAddressBooks from '@/hooks/useAllAddressBooks'
import * as urlChainId from '@/hooks/useChainId'
import { act, fireEvent, waitFor } from '@testing-library/react'
import { render } from '@/tests/test-utils'
import { useForm, FormProvider } from 'react-hook-form'
import AddressInput, { type AddressInputProps } from '.'
import { useChain, useCurrentChain } from '@/hooks/useChains'
import useNameResolver from '@/components/common/AddressInput/useNameResolver'
import useHederaAccountIdResolver from '@/components/common/AddressInput/useHederaAccountIdResolver'
import { chainBuilder } from '@/tests/builders/chains'
import { FEATURES } from '@safe-global/store/gateway/types'
import { FEATURES as CHAIN_FEATURES } from '@safe-global/utils/utils/chains'
import userEvent from '@testing-library/user-event'
import { ContactSource } from '@/hooks/useAllAddressBooks'
import * as tronUtils from '@/utils/tron'
import { FEATURES as UTILS_FEATURES } from '@safe-global/utils/utils/chains'

const ROOTSTOCK_SUPPORT = UTILS_FEATURES.ROOTSTOCK_SUPPORT

const mockChain = chainBuilder()
  .with({ features: [FEATURES.DOMAIN_LOOKUP] })
  .with({ chainId: '11155111' })
  .build()

// mock useCurrentChain
jest.mock('@/hooks/useChains', () => ({
  __esModule: true,
  default: jest.fn(() => ({ configs: [] })),
  useCurrentChain: jest.fn(() => mockChain),
  useChain: jest.fn(() => mockChain),
  useHasFeature: jest.fn(() => false),
}))

// mock useNameResolver
jest.mock('@/components/common/AddressInput/useNameResolver', () => ({
  __esModule: true,
  default: jest.fn((val: string) => ({
    address: val === 'zero.eth' ? '0x0000000000000000000000000000000000000000' : undefined,
    resolverError: val === 'bogus.eth' ? new Error('Failed to resolve') : undefined,
    resolving: false,
  })),
}))

// mock useHederaAccountIdResolver
jest.mock('@/components/common/AddressInput/useHederaAccountIdResolver', () => ({
  __esModule: true,
  default: jest.fn((val: string) => ({
    address: val === '0.0.10814740' ? '0x000000000000000000000000000000000000004d' : undefined,
    resolverError: val === '0.0.notfound' ? new Error('Failed to resolve Hedera account') : undefined,
    resolving: false,
  })),
}))

const TestForm = ({
  address,
  validate,
  disabled,
}: {
  address: string
  validate?: AddressInputProps['validate']
  disabled?: boolean
}) => {
  const name = 'recipient'

  const methods = useForm<{
    [name]: string
  }>({
    defaultValues: {
      [name]: address,
    },
    mode: 'all',
  })

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(() => null)}>
        <AddressInput name={name} label="Recipient address" validate={validate} disabled={disabled} />
        <button type="submit">Submit</button>
      </form>
    </FormProvider>
  )
}

const setup = (address: string, validate?: AddressInputProps['validate'], disabled?: boolean) => {
  const utils = render(<TestForm address={address} validate={validate} disabled={disabled} />)
  const input = utils.getByLabelText('Recipient address', { exact: false })

  return {
    input: input as HTMLInputElement,
    utils,
  }
}

const TEST_ADDRESS_A = '0x0000000000000000000000000000000000000000'
const TEST_ADDRESS_B = '0x0000000000000000000000000000000000000001'

describe('AddressInput tests', () => {
  beforeAll(() => {
    jest.useFakeTimers()
  })

  afterAll(() => {
    jest.useRealTimers()
  })

  beforeEach(() => {
    jest.clearAllMocks()
    ;(useCurrentChain as jest.Mock).mockImplementation(() => mockChain)
    jest.spyOn(addressBook, 'default').mockReturnValue({})
  })

  it('should render with a default address value', () => {
    const { input } = setup(TEST_ADDRESS_A)
    expect(input.value).toBe(TEST_ADDRESS_A)
  })

  it('should render with a default prefixed address value', () => {
    const { input } = setup(`eth:${TEST_ADDRESS_A}`)
    expect(input.value).toBe(`eth:${TEST_ADDRESS_A}`)
  })

  // TODO: This test is flaky and regularly times out after 5000ms
  it('should validate the address on input', async () => {
    const { input, utils } = setup('')

    act(() => {
      fireEvent.change(input, { target: { value: `eth:${TEST_ADDRESS_A}` } })
      jest.advanceTimersByTime(1000)
    })

    await waitFor(() =>
      expect(utils.getByLabelText(`"eth" doesn't match the current chain`, { exact: false })).toBeDefined(),
    )

    // The validation error should persist on blur
    await act(async () => {
      fireEvent.blur(input)
      jest.advanceTimersByTime(1000)
      await Promise.resolve()
    })

    await waitFor(() =>
      expect(utils.getByLabelText(`"eth" doesn't match the current chain`, { exact: false })).toBeDefined(),
    )

    act(() => {
      fireEvent.change(input, { target: { value: `${mockChain.shortName}:0x123` } })
      jest.advanceTimersByTime(1000)
    })

    await waitFor(() => expect(utils.getByLabelText(`Invalid address format`, { exact: false })).toBeDefined())
  })

  it('should accept a custom validate function', async () => {
    const { input, utils } = setup('', (val) => `${val} is wrong`)

    act(() => {
      fireEvent.change(input, { target: { value: `${mockChain.shortName}:${TEST_ADDRESS_A}` } })
      jest.advanceTimersByTime(1000)
    })

    await waitFor(() => expect(utils.getByLabelText(`${TEST_ADDRESS_A} is wrong`, { exact: false })).toBeDefined())

    act(() => {
      fireEvent.change(input, { target: { value: `${mockChain.shortName}:${TEST_ADDRESS_B}` } })
      jest.advanceTimersByTime(1000)
    })

    await waitFor(() => expect(utils.getByLabelText(`${TEST_ADDRESS_B} is wrong`, { exact: false })).toBeDefined())
  })

  // TODO: This test is flaky and regularly times out after 5000ms
  it('should show a spinner when validation is in progress', async () => {
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

    const { input, utils } = setup('', async (val) => {
      await sleep(2000)
      return `${val} is wrong`
    })

    act(() => {
      fireEvent.change(input, { target: { value: `${mockChain.shortName}:${TEST_ADDRESS_A}` } })
      jest.advanceTimersByTime(1000)
    })

    await waitFor(() => {
      expect(utils.getByRole('progressbar')).toBeDefined()
      expect(utils.queryByLabelText(`${TEST_ADDRESS_A} is wrong`, { exact: false })).toBeNull()
    })

    act(() => {
      jest.advanceTimersByTime(1000)
    })

    await waitFor(() => expect(utils.getByLabelText(`${TEST_ADDRESS_A} is wrong`, { exact: false })).toBeDefined())
  })

  it('should resolve ENS names', async () => {
    const { input } = setup('')

    act(() => {
      fireEvent.change(input, { target: { value: 'zero.eth' } })
    })

    await waitFor(() => {
      expect(input.value).toBe('0x0000000000000000000000000000000000000000')
      expect(useNameResolver).toHaveBeenCalledWith('zero.eth')
    })
  })

  it('should show an error if ENS resolution has failed', async () => {
    const { input, utils } = setup('')

    act(() => {
      fireEvent.change(input, { target: { value: 'bogus.eth' } })
      jest.advanceTimersByTime(1000)
    })

    expect(useNameResolver).toHaveBeenCalledWith('bogus.eth')
    await waitFor(() => expect(utils.getByLabelText(`Failed to resolve`, { exact: false })).toBeDefined())
  })

  it('should not resolve ENS names if this feature is disabled', async () => {
    ;(useCurrentChain as jest.Mock).mockImplementation(() => ({
      shortName: 'gor',
      chainId: '5',
      chainName: 'Goerli',
      features: [],
    }))

    const { input, utils } = setup('')

    act(() => {
      fireEvent.change(input, { target: { value: 'zero.eth' } })
      jest.advanceTimersByTime(1000)
    })

    expect(useNameResolver).toHaveBeenCalledWith('')
    await waitFor(() => expect(input.value).toBe('zero.eth'))
    await waitFor(() => expect(utils.getByLabelText('Invalid address format', { exact: false })).toBeDefined())
  })

  it('should resolve a native Hedera account id (0.0.X) on a Hedera chain', async () => {
    const hederaChain = chainBuilder()
      .with({ chainId: '296', shortName: 'hedera', isTestnet: true, features: [CHAIN_FEATURES.HEDERA] })
      .build()
    ;(useCurrentChain as jest.Mock).mockImplementation(() => hederaChain)

    const { input } = setup('')

    act(() => {
      fireEvent.change(input, { target: { value: '0.0.10814740' } })
    })

    await waitFor(() => {
      expect(input.value).toBe('0x000000000000000000000000000000000000004D')
      expect(useHederaAccountIdResolver).toHaveBeenCalledWith('0.0.10814740', 'testnet')
    })
  })

  it('should show an error if Hedera account id resolution has failed', async () => {
    const hederaChain = chainBuilder()
      .with({ chainId: '296', shortName: 'hedera', isTestnet: true, features: [CHAIN_FEATURES.HEDERA] })
      .build()
    ;(useCurrentChain as jest.Mock).mockImplementation(() => hederaChain)

    const { input, utils } = setup('')

    act(() => {
      fireEvent.change(input, { target: { value: '0.0.notfound' } })
      jest.advanceTimersByTime(1000)
    })

    expect(useHederaAccountIdResolver).toHaveBeenCalledWith('0.0.notfound', 'testnet')
    await waitFor(() =>
      expect(utils.getByLabelText(`Failed to resolve Hedera account`, { exact: false })).toBeDefined(),
    )
  })

  it('should not flash an "Invalid address format" error once a Hedera account id has resolved', async () => {
    // Regression test: once resolution succeeds, `watchedValue` becomes the resolved 0x address,
    // which is no longer a valid Hedera account id shape — so the resolver mock (matching real
    // `useHederaAccountIdResolver` behaviour) reports `address: undefined` again on the next
    // render. That transient flip used to unconditionally re-trigger validation on an unchanged,
    // already-valid value and could intermittently surface a stale "Invalid address format" error.
    const hederaChain = chainBuilder()
      .with({ chainId: '296', shortName: 'hedera', isTestnet: true, features: [CHAIN_FEATURES.HEDERA] })
      .build()
    ;(useCurrentChain as jest.Mock).mockImplementation(() => hederaChain)

    const { input, utils } = setup('')

    act(() => {
      fireEvent.change(input, { target: { value: '0.0.10814740' } })
    })

    await waitFor(() => {
      expect(input.value).toBe('0x000000000000000000000000000000000000004D')
    })

    // Blur and refocus — this is what re-triggers validation in the real app.
    act(() => {
      fireEvent.blur(input)
      jest.advanceTimersByTime(200)
    })
    act(() => {
      fireEvent.focus(input)
      jest.advanceTimersByTime(200)
    })

    expect(utils.queryByLabelText('Invalid address format', { exact: false })).toBeNull()
    expect(input.value).toBe('0x000000000000000000000000000000000000004D')
  })

  it('should not resolve Hedera account ids on a non-Hedera chain', async () => {
    const { input } = setup('')

    act(() => {
      fireEvent.change(input, { target: { value: '0.0.10814740' } })
      jest.advanceTimersByTime(1000)
    })

    expect(useHederaAccountIdResolver).toHaveBeenCalledWith('', undefined)
  })

  it('should show chain prefix in an adornment', async () => {
    const { input } = setup(TEST_ADDRESS_A)

    await waitFor(() => expect(input.value).toBe(TEST_ADDRESS_A))

    expect(input.previousElementSibling?.textContent).toBe(`${mockChain.shortName}:`)
  })

  it('should show the Tron chain prefix in the adornment', () => {
    ;(useCurrentChain as jest.Mock).mockReturnValue(
      chainBuilder().with({ chainId: '728126428', shortName: 'trx', features: [] }).build(),
    )
    const { input } = setup(TEST_ADDRESS_B)
    expect(input.previousElementSibling?.textContent).toBe('trx:')
  })

  it('should display the base58 address on a Tron chain when the format setting is base58', async () => {
    const base58Address = 'TB2c4z3BMsxhY6EsmkqcktUuonyVYXWFhC'
    jest.spyOn(tronUtils, 'toTronBase58Sync').mockReturnValue(base58Address)
    ;(useCurrentChain as jest.Mock).mockReturnValue(
      chainBuilder().with({ chainId: '728126428', shortName: 'trx', features: [] }).build(),
    )

    const utils = render(<TestForm address={TEST_ADDRESS_B} />, {
      initialReduxState: { settings: { tronAddressFormat: 'base58' } } as any,
    })
    const input = utils.getByLabelText('Recipient address', { exact: false }) as HTMLInputElement

    await waitFor(() => expect(input.value).toBe(base58Address))
  })

  it('should keep the hex address on a Tron chain when the format setting is hex', async () => {
    const toTronBase58SyncSpy = jest.spyOn(tronUtils, 'toTronBase58Sync')
    ;(useCurrentChain as jest.Mock).mockReturnValue(
      chainBuilder().with({ chainId: '728126428', shortName: 'trx', features: [] }).build(),
    )

    const utils = render(<TestForm address={TEST_ADDRESS_B} />, {
      initialReduxState: { settings: { tronAddressFormat: 'hex' } } as any,
    })
    const input = utils.getByLabelText('Recipient address', { exact: false }) as HTMLInputElement

    await waitFor(() => expect(input.value).toBe(TEST_ADDRESS_B))
    expect(toTronBase58SyncSpy).not.toHaveBeenCalled()
  })

  // TODO: Fix this test
  it.skip('should not show the adornment prefix when the value contains correct prefix', async () => {
    const mockChain = chainBuilder().with({ features: [] }).build()
    ;(useCurrentChain as jest.Mock).mockImplementation(() => mockChain)

    const { input } = setup(`${mockChain.shortName}:${TEST_ADDRESS_A}`)

    fireEvent.change(input, { target: { value: `${mockChain.shortName}:${TEST_ADDRESS_B}` } })

    await waitFor(() => expect(input.previousElementSibling?.textContent).toBe(''))
  })

  it('should keep a bare address in the form state', async () => {
    let methods: any

    const Form = () => {
      const name = 'recipient'

      methods = useForm<{
        [name]: string
      }>({
        defaultValues: {
          [name]: '',
        },
      })

      return (
        <FormProvider {...methods}>
          <form onSubmit={methods.handleSubmit(() => null)}>
            <AddressInput name={name} label="Recipient" />
          </form>
        </FormProvider>
      )
    }

    const utils = render(<Form />)
    const input = utils.getByLabelText('Recipient', { exact: false }) as HTMLInputElement

    act(() => {
      fireEvent.change(input, { target: { value: `${mockChain.shortName}:${TEST_ADDRESS_A}` } })
    })

    expect(methods.getValues().recipient).toBe(TEST_ADDRESS_A)
  })

  it('should clean up the input value if it contains a valid address', async () => {
    ;(useCurrentChain as jest.Mock).mockImplementation(() => ({
      shortName: 'gor',
      chainId: '5',
      chainName: 'Goerli',
      features: [],
    }))

    const { input } = setup(``)

    act(() => {
      fireEvent.change(input, { target: { value: `Here's my address: ${TEST_ADDRESS_A}` } })
    })

    await waitFor(() => expect(input.value).toBe(TEST_ADDRESS_A))
  })

  describe('Rootstock', () => {
    const RSK_MAINNET_ADDRESS = '0x5aaEB6053f3e94c9b9a09f33669435E7ef1bEAeD'
    const RSK_TESTNET_ADDRESS = '0x5aAeb6053F3e94c9b9A09F33669435E7EF1BEaEd'
    const EIP55_ADDRESS = '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed'

    const mockRskChain = (features: string[]) =>
      (useCurrentChain as jest.Mock).mockImplementation(() =>
        chainBuilder().with({ chainId: '31', shortName: 'trbtc', features }).build(),
      )

    it.each([RSK_MAINNET_ADDRESS, RSK_TESTNET_ADDRESS])(
      'should accept the EIP-1191 address %s and convert it to EIP-55',
      async (address) => {
        mockRskChain([ROOTSTOCK_SUPPORT])
        const { input, utils } = setup('')

        act(() => {
          fireEvent.change(input, { target: { value: address } })
          jest.advanceTimersByTime(1000)
        })

        await waitFor(() => expect(input.value).toBe(EIP55_ADDRESS))
        expect(utils.queryByLabelText('Invalid address checksum', { exact: false })).toBeNull()
      },
    )

    describe('display format', () => {
      beforeEach(() => {
        const rskChain = chainBuilder()
          .with({ chainId: '31', shortName: 'trbtc', features: [ROOTSTOCK_SUPPORT] })
          .build()
        ;(useCurrentChain as jest.Mock).mockImplementation(() => rskChain)
        ;(useChain as jest.Mock).mockImplementation(() => rskChain)
      })

      afterEach(() => {
        ;(useChain as jest.Mock).mockImplementation(() => mockChain)
      })

      it('should display the EIP-1191 address by default', async () => {
        const { input } = setup(EIP55_ADDRESS)

        await waitFor(() => expect(input.value).toBe(RSK_TESTNET_ADDRESS))
      })

      it('should display the EIP-55 address when the checksum setting is off', async () => {
        const utils = render(<TestForm address={EIP55_ADDRESS} />, {
          initialReduxState: { settings: { rootstockAddressChecksum: false } } as any,
        })
        const input = utils.getByLabelText('Recipient address', { exact: false }) as HTMLInputElement

        await waitFor(() => expect(input.value).toBe(EIP55_ADDRESS))
      })

      it('should keep the EIP-55 address in the form state', async () => {
        const onSubmit = jest.fn()
        const Form = () => {
          const methods = useForm({ defaultValues: { recipient: EIP55_ADDRESS }, mode: 'all' })
          return (
            <FormProvider {...methods}>
              <form onSubmit={methods.handleSubmit(onSubmit)}>
                <AddressInput name="recipient" label="Recipient address" />
                <button type="submit">Submit</button>
              </form>
            </FormProvider>
          )
        }
        const utils = render(<Form />)

        await act(async () => {
          fireEvent.click(utils.getByText('Submit'))
          jest.advanceTimersByTime(1000)
        })

        await waitFor(() => expect(onSubmit).toHaveBeenCalled())
        expect(onSubmit.mock.calls[0][0]).toEqual({ recipient: EIP55_ADDRESS })
      })
    })

    it('should reject the EIP-1191 address when Rootstock support is disabled', async () => {
      mockRskChain([])
      const { input, utils } = setup('')

      act(() => {
        fireEvent.change(input, { target: { value: RSK_TESTNET_ADDRESS } })
        jest.advanceTimersByTime(1000)
      })

      await waitFor(() => expect(utils.getByLabelText('Invalid address checksum', { exact: false })).toBeDefined())
    })
  })

  it('should display a read-only input if the address is in the address book', async () => {
    const mockChainId = '11155111'
    const mockSafeName = 'Test Safe'
    const mockAB = { [TEST_ADDRESS_A]: mockSafeName }
    const mockContact = {
      name: mockSafeName,
      address: TEST_ADDRESS_A,
      chainIds: [mockChainId],
      createdBy: '',
      lastUpdatedBy: '',
      source: ContactSource.local,
    }

    jest.spyOn(urlChainId, 'default').mockImplementation(() => mockChainId)
    jest.spyOn(allAddressBooks, 'useAddressBookItem').mockReturnValue(mockContact)
    jest.spyOn(addressBook, 'default').mockImplementation(() => mockAB)

    const { input, utils } = setup(TEST_ADDRESS_A)

    act(() => {
      fireEvent.change(input, { target: { value: TEST_ADDRESS_A } })
    })

    await waitFor(() => expect(utils.getByText(mockSafeName)).toBeInTheDocument())
  })

  it('should clear the input on click if the address is in the address book and not disabled', async () => {
    const mockChainId = '11155111'
    const mockSafeName = 'Test Safe'
    const mockAB = { [TEST_ADDRESS_A]: mockSafeName }
    const mockContact = {
      name: mockSafeName,
      address: TEST_ADDRESS_A,
      chainIds: [mockChainId],
      createdBy: '',
      lastUpdatedBy: '',
      source: ContactSource.local,
    }

    jest.spyOn(urlChainId, 'default').mockImplementation(() => mockChainId)
    jest.spyOn(allAddressBooks, 'useAddressBookItem').mockReturnValue(mockContact)
    jest.spyOn(addressBook, 'default').mockImplementation(() => mockAB)

    const { input, utils } = setup(TEST_ADDRESS_A)

    act(() => {
      fireEvent.change(input, { target: { value: TEST_ADDRESS_A } })
    })

    await waitFor(() => {
      expect(utils.getByText(mockSafeName)).toBeInTheDocument()
      expect(utils.getByRole('textbox')).toHaveValue(TEST_ADDRESS_A)
    })

    act(() => {
      userEvent.click(input)
    })

    await waitFor(() => expect(utils.getByRole('textbox')).toHaveValue(''))
  })

  it('should not clear the input on click if the address is in the address book and the input is disabled', async () => {
    const mockChainId = '11155111'
    const mockSafeName = 'Test Safe'
    const mockAB = { [TEST_ADDRESS_A]: mockSafeName }
    const mockContact = {
      name: mockSafeName,
      address: TEST_ADDRESS_A,
      chainIds: [mockChainId],
      createdBy: '',
      lastUpdatedBy: '',
      source: ContactSource.local,
    }

    jest.spyOn(urlChainId, 'default').mockImplementation(() => mockChainId)
    jest.spyOn(allAddressBooks, 'useAddressBookItem').mockReturnValue(mockContact)
    jest.spyOn(addressBook, 'default').mockImplementation(() => mockAB)

    const { input, utils } = setup(TEST_ADDRESS_A, undefined, true)

    act(() => {
      fireEvent.change(input, { target: { value: TEST_ADDRESS_A } })
    })

    await waitFor(() => {
      expect(utils.getByText(mockSafeName)).toBeInTheDocument()
      expect(utils.getByRole('textbox')).toHaveValue(TEST_ADDRESS_A)
    })

    act(() => {
      userEvent.click(input)
    })

    await waitFor(() => expect(utils.getByRole('textbox')).toHaveValue(TEST_ADDRESS_A))
  })
})
