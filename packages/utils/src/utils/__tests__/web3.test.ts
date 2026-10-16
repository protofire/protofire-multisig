import type { JsonRpcSigner } from 'ethers'
import { signTypedData } from '@safe-global/utils/utils/web3'

describe('web3', () => {
  describe('signTypedData', () => {
    const mockSignature =
      '0xe658c4de8780d5f2182ad364e8be4b1a63f59a2abf53fab05113ab1087ccf7fe50a9ae164517b24b8c886432a7fddf18bd73b0d6d43b8a5077c0f26e982a63b91b'

    it('should sign typed data', async () => {
      const signer = {
        signTypedData: jest.fn().mockResolvedValue(mockSignature),
      }
      const typedData = {
        domain: {
          chainId: 1,
          name: 'name',
          version: '1',
        },
        types: {
          EIP712Domain: [],
        },
        message: {},
        primaryType: 'EIP712Domain',
      }
      const result = await signTypedData(signer as unknown as JsonRpcSigner, typedData)
      expect(result).toBe(mockSignature)
    })

    it.each([
      [1, 0, 27],
      [1, 1, 28],
      [1, 27, 27],
      [728126428, 58, 58],
      [2494104990, 59, 59],
      [1, 58, undefined],
      [137, 59, undefined],
      [728126428, 60, undefined],
      [728126428, 255, undefined],
    ])('validates signature V %s/%s by typed-data chain', async (chainId, v, expected) => {
      const signature = mockSignature.slice(0, -2) + v.toString(16).padStart(2, '0')
      const signer = { signTypedData: jest.fn().mockResolvedValue(signature) }
      const typedData = {
        domain: { chainId },
        types: { Message: [{ name: 'value', type: 'uint256' }] },
        message: { value: 1 },
        primaryType: 'Message',
      }
      const result = signTypedData(signer as unknown as JsonRpcSigner, typedData)
      if (expected === undefined) {
        await expect(result).rejects.toThrow('Invalid signature')
      } else {
        await expect(result).resolves.toBe(mockSignature.slice(0, -2) + expected.toString(16))
      }
    })

    it('should throw an error if signTypedData fails', async () => {
      const signer = {
        signTypedData: jest.fn().mockRejectedValue(new Error('error')),
      }
      const typedData = {
        domain: {
          chainId: 1,
          name: 'name',
          version: '1',
        },
        types: {
          EIP712Domain: [],
        },
        message: {},
        primaryType: 'EIP712Domain',
      }
      await expect(signTypedData(signer as unknown as JsonRpcSigner, typedData)).rejects.toThrow('error')
    })

    it('should fall back to signTypedData if signTypedData_v4 is not available', async () => {
      const error = new Error('error') as Error & { code: string }
      error.code = 'UNSUPPORTED_OPERATION'

      const signer = {
        signTypedData: jest.fn().mockRejectedValue(error),
        address: '0x1234567890123456789012345678901234567890',
        provider: {
          send: jest.fn().mockResolvedValue(mockSignature),
        },
      }
      const typedData = {
        types: {
          DeleteRequest: [
            { name: 'safeTxHash', type: 'bytes32' },
            { name: 'totp', type: 'uint256' },
          ],
        },
        domain: {
          name: 'Safe Transaction Service',
          version: '1.0',
          chainId: 1,
          verifyingContract: '0x1234567890123456789012345678901234567890',
        },
        message: {
          safeTxHash: '0x1234567890123456789012345678901234567890123456789012345678901234',
          totp: Math.floor(Date.now() / 3600e3),
        },
        primaryType: 'DeleteRequest',
      }
      const result = await signTypedData(signer as unknown as JsonRpcSigner, typedData)
      expect(result).toBe(mockSignature)
    })
  })
})
