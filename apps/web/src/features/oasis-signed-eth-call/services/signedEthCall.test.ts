import { encode as cborEncode } from 'cborg'
import { hexlify, type JsonRpcProvider } from 'ethers'
import { faker } from '@faker-js/faker'
import { isJsonRpcRevert, isSapphireEnvelopeFailure, validateOasisSignedCall } from './signedEthCall'

// Node's Buffer fails ethers' Uint8Array check under jsdom; browsers return a plain Uint8Array
jest.mock('cborg', () => {
  const actual = jest.requireActual('cborg')
  return { ...actual, encode: (value: unknown) => new Uint8Array(actual.encode(value)) }
})

const mockDecryptResult = jest.fn()
const mockSignTypedData = jest.fn()
const mockCipher = {
  encryptCall: jest.fn(),
  decryptResult: mockDecryptResult,
}

jest.mock('@oasisprotocol/sapphire-paratime', () => ({
  KeyFetcher: jest.fn().mockImplementation(() => ({
    fetch: jest.fn().mockResolvedValue(undefined),
    cipherSync: () => mockCipher,
  })),
}))

jest.mock('ethers', () => {
  const actual = jest.requireActual('ethers')
  return {
    ...actual,
    BrowserProvider: jest.fn().mockImplementation(() => ({
      getSigner: jest.fn().mockResolvedValue({ signTypedData: mockSignTypedData }),
    })),
  }
})

const CURRENT_BLOCK = 1_000
const LEASH_HASH = `0x${'11'.repeat(32)}`
const SIGNATURE = `0x${'22'.repeat(65)}`

const createReadOnlyProvider = () =>
  ({
    getBlockNumber: jest.fn().mockResolvedValue(CURRENT_BLOCK),
    getBlock: jest.fn().mockResolvedValue({ hash: LEASH_HASH }),
    getTransactionCount: jest.fn().mockResolvedValue(7),
    send: jest.fn().mockResolvedValue('0xresult'),
  }) as unknown as JsonRpcProvider & { send: jest.Mock }

const createParams = () => ({
  from: faker.finance.ethereumAddress(),
  to: faker.finance.ethereumAddress(),
  // Unique per test so the module-level signed-call cache never leaks between cases
  data: `0x${faker.string.hexadecimal({ length: 16, casing: 'lower', prefix: '' })}`,
})

const revertRpcError = Object.assign(new Error('execution reverted'), { error: { code: 3 } })

describe('isJsonRpcRevert', () => {
  it('detects the raw RPC code at error.error.code', () => {
    expect(isJsonRpcRevert({ error: { code: 3 } })).toBe(true)
  })

  it('detects the raw RPC code at error.info.error.code', () => {
    expect(isJsonRpcRevert({ info: { error: { code: 3 } } })).toBe(true)
  })

  it('ignores other RPC codes and non-objects', () => {
    expect(isJsonRpcRevert({ error: { code: -32000 } })).toBe(false)
    expect(isJsonRpcRevert('boom')).toBe(false)
    expect(isJsonRpcRevert(null)).toBe(false)
  })
})

describe('isSapphireEnvelopeFailure', () => {
  it('treats an envelope failure with module and code as a failure', () => {
    expect(isSapphireEnvelopeFailure({ response: { module: 'evm', code: 8 } })).toBe(true)
  })

  it('treats CALL_EXCEPTION as a failure', () => {
    expect(isSapphireEnvelopeFailure({ code: 'CALL_EXCEPTION' })).toBe(true)
  })

  it('does not treat other errors as failures', () => {
    expect(isSapphireEnvelopeFailure({ code: 'UNKNOWN_ERROR' })).toBe(false)
    expect(isSapphireEnvelopeFailure(undefined)).toBe(false)
  })
})

describe('validateOasisSignedCall', () => {
  const eip1193Provider = { request: jest.fn() } as unknown as Parameters<typeof validateOasisSignedCall>[1]

  beforeEach(() => {
    jest.clearAllMocks()
    mockCipher.encryptCall.mockReturnValue(hexlify(cborEncode({ format: 1 })))
    mockSignTypedData.mockResolvedValue(SIGNATURE)
    mockDecryptResult.mockReturnValue(undefined)
  })

  it('sends the signed payload as eth_call with the signed gas values', async () => {
    const readOnlyProvider = createReadOnlyProvider()
    const params = createParams()

    await validateOasisSignedCall(readOnlyProvider, eip1193Provider, params, 23294)

    expect(readOnlyProvider.send).toHaveBeenCalledWith('eth_call', [
      expect.objectContaining({
        to: params.to,
        from: params.from,
        gas: `0x${30_000_000n.toString(16)}`,
        gasPrice: `0x${100_000_000_000n.toString(16)}`,
      }),
      'latest',
    ])
    expect(mockDecryptResult).toHaveBeenCalledWith('0xresult')
  })

  it('signs the call once and reuses it while the leash is valid', async () => {
    const readOnlyProvider = createReadOnlyProvider()
    const params = createParams()

    await validateOasisSignedCall(readOnlyProvider, eip1193Provider, params, 23294)
    await validateOasisSignedCall(readOnlyProvider, eip1193Provider, params, 23294)

    expect(mockSignTypedData).toHaveBeenCalledTimes(1)
    expect(readOnlyProvider.send).toHaveBeenCalledTimes(2)
  })

  it('signs again for the same call on another chain instead of reusing the cached payload', async () => {
    const readOnlyProvider = createReadOnlyProvider()
    const params = createParams()

    await validateOasisSignedCall(readOnlyProvider, eip1193Provider, params, 23294)
    await validateOasisSignedCall(readOnlyProvider, eip1193Provider, params, 23295)

    expect(mockSignTypedData).toHaveBeenCalledTimes(2)
    expect(mockSignTypedData.mock.calls[0][0]).toMatchObject({ chainId: 23294 })
    expect(mockSignTypedData.mock.calls[1][0]).toMatchObject({ chainId: 23295 })
  })

  it.each([
    ['gas limit', { gasLimit: 1_000_000n }],
    ['value', { value: 1n }],
  ])('signs again when the %s changes, since both are part of the signed message', async (_, changed) => {
    const readOnlyProvider = createReadOnlyProvider()
    const params = createParams()

    await validateOasisSignedCall(readOnlyProvider, eip1193Provider, params, 23294)
    await validateOasisSignedCall(readOnlyProvider, eip1193Provider, { ...params, ...changed }, 23294)

    expect(mockSignTypedData).toHaveBeenCalledTimes(2)
  })

  it('rethrows when the user dismisses the signing prompt and sends no eth_call', async () => {
    const readOnlyProvider = createReadOnlyProvider()
    const rejection = Object.assign(new Error('user rejected action'), { code: 'ACTION_REJECTED' })
    mockSignTypedData.mockRejectedValue(rejection)

    await expect(validateOasisSignedCall(readOnlyProvider, eip1193Provider, createParams(), 23294)).rejects.toBe(
      rejection,
    )
    expect(readOnlyProvider.send).not.toHaveBeenCalled()
  })

  it('rethrows a revert reported as a plain RPC error', async () => {
    const readOnlyProvider = createReadOnlyProvider()
    readOnlyProvider.send.mockRejectedValue(revertRpcError)

    await expect(validateOasisSignedCall(readOnlyProvider, eip1193Provider, createParams(), 23294)).rejects.toBe(
      revertRpcError,
    )
  })

  it('resolves silently on other RPC errors, since validation is unavailable', async () => {
    const readOnlyProvider = createReadOnlyProvider()
    readOnlyProvider.send.mockRejectedValue(new Error('epoch expired'))

    await expect(
      validateOasisSignedCall(readOnlyProvider, eip1193Provider, createParams(), 23294),
    ).resolves.toBeUndefined()
    expect(mockDecryptResult).not.toHaveBeenCalled()
  })

  it('throws when the decrypted envelope reports a Safe revert', async () => {
    const envelopeFailure = Object.assign(new Error('GS013'), { response: { module: 'evm', code: 8 } })
    mockDecryptResult.mockImplementation(() => {
      throw envelopeFailure
    })

    await expect(
      validateOasisSignedCall(createReadOnlyProvider(), eip1193Provider, createParams(), 23294),
    ).rejects.toBe(envelopeFailure)
  })

  it('ignores decryption format errors, since validation is unavailable', async () => {
    mockDecryptResult.mockImplementation(() => {
      throw new Error('Received unencrypted envelope')
    })

    await expect(
      validateOasisSignedCall(createReadOnlyProvider(), eip1193Provider, createParams(), 23294),
    ).resolves.toBeUndefined()
  })
})
