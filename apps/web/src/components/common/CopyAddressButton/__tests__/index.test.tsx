import { act, render, waitFor } from '@/tests/test-utils'
import { checksumAddress } from '@safe-global/utils/utils/addresses'
import { toEip1191ChecksumAddress } from '@safe-global/utils/utils/rsk-utils'
import { faker } from '@faker-js/faker'
import CopyAddressButton from '..'

const originalClipboard = { ...global.navigator.clipboard }

class FakeClipboard {
  private text = ''
  readText() {
    return Promise.resolve(this.text)
  }

  writeText(text: string) {
    this.text = text
  }
}

describe('CopyAddressButton', () => {
  beforeAll(() => {
    //@ts-ignore
    navigator.clipboard = new FakeClipboard()
  })

  beforeEach(() => {
    navigator.clipboard.writeText('')
  })

  afterAll(() => {
    //@ts-ignore
    navigator.clipboard = originalClipboard
  })
  it('should copy a trusted address', async () => {
    const address = faker.finance.ethereumAddress()
    const result = render(<CopyAddressButton address={address} trusted />)

    act(() => {
      result.getByRole('button').click()
    })

    await waitFor(async () => {
      const copiedText = await navigator.clipboard.readText()
      expect(copiedText).toEqual(address)
    })
  })

  it('should show the EIP-55 address in the confirmation modal for an EIP-1191 address', async () => {
    const address = checksumAddress(faker.finance.ethereumAddress())
    const rskAddress = toEip1191ChecksumAddress(address, 30)
    const result = render(<CopyAddressButton address={rskAddress} trusted={false} />)

    act(() => {
      result.getByRole('button').click()
    })

    expect(result.getByText(address)).toBeVisible()

    act(() => {
      result.getByText('Proceed and copy').click()
    })

    await waitFor(async () => {
      expect(await navigator.clipboard.readText()).toEqual(rskAddress)
    })
  })

  it('should show a confirmation modal when copying an untrusted address', async () => {
    const address = checksumAddress(faker.finance.ethereumAddress())
    const result = render(<CopyAddressButton address={address} trusted={false} />)

    act(() => {
      result.getByRole('button').click()
    })

    expect(result.getByText(address)).toBeVisible()
    expect(navigator.clipboard.readText()).resolves.toEqual('')

    act(() => {
      result.getByText('Proceed and copy').click()
    })

    await waitFor(async () => {
      const copiedText = await navigator.clipboard.readText()
      expect(copiedText).toEqual(address)
    })
  })

  it('should not copy an untrusted address if the modal gets closed', async () => {
    const address = checksumAddress(faker.finance.ethereumAddress())
    const result = render(<CopyAddressButton address={address} trusted={false} />)

    act(() => {
      result.getByRole('button').click()
    })

    expect(result.getByText(address)).toBeVisible()
    expect(navigator.clipboard.readText()).resolves.toEqual('')

    result.getByLabelText('close').click()

    await waitFor(async () => {
      expect(navigator.clipboard.readText()).resolves.toEqual('')
      expect(result.queryByText(address)).not.toBeVisible()
    })
  })
})
