import { type JsonRpcProvider, toBeHex } from 'ethers'
import { EMPTY_DATA } from '@safe-global/protocol-kit/dist/src/utils/constants'

import * as web3ReadOnly from '@/hooks/wallets/web3ReadOnly'
import {
  isSmartContractWallet,
  getSmartContractWalletStatus,
  isSmartContract,
  isEIP7702DelegatedAccount,
  isWalletUnlocked,
  EIP_7702_DELEGATED_ACCOUNT_PREFIX,
} from '@/utils/wallets'

describe('wallets', () => {
  const getCodeMock = jest.fn()

  beforeEach(() => {
    isSmartContractWallet.cache.clear?.()

    jest.clearAllMocks()

    jest.spyOn(web3ReadOnly, 'getWeb3ReadOnly').mockImplementation(() => {
      return {
        getCode: getCodeMock,
      } as unknown as JsonRpcProvider
    })
  })

  describe('isSmartContract', () => {
    it('should return true for accounts with bytecode', async () => {
      getCodeMock.mockResolvedValue('0x608060405234801561001057600080fd5b5')

      const result = await isSmartContract(toBeHex('0x1', 20))

      expect(result).toBe(true)
      expect(getCodeMock).toHaveBeenCalledWith(toBeHex('0x1', 20))
    })

    it('should return false for EOAs (empty bytecode)', async () => {
      getCodeMock.mockResolvedValue(EMPTY_DATA)

      const result = await isSmartContract(toBeHex('0x1', 20))

      expect(result).toBe(false)
    })
  })

  describe('isEIP7702DelegatedAccount', () => {
    it('should return true for EIP-7702 delegated accounts', async () => {
      const eip7702Code = EIP_7702_DELEGATED_ACCOUNT_PREFIX + '1234567890abcdef1234567890abcdef12345678'
      getCodeMock.mockResolvedValue(eip7702Code)

      const result = await isEIP7702DelegatedAccount(toBeHex('0x1', 20))

      expect(result).toBe(true)
    })

    it('should return false for regular smart contracts', async () => {
      getCodeMock.mockResolvedValue('0x608060405234801561001057600080fd5b5')

      const result = await isEIP7702DelegatedAccount(toBeHex('0x1', 20))

      expect(result).toBe(false)
    })

    it('should return false for EOAs', async () => {
      getCodeMock.mockResolvedValue(EMPTY_DATA)

      const result = await isEIP7702DelegatedAccount(toBeHex('0x1', 20))

      expect(result).toBe(false)
    })
  })

  describe('isSmartContractWallet', () => {
    it('should return true for regular smart contracts (not EIP-7702)', async () => {
      getCodeMock.mockResolvedValue('0x608060405234801561001057600080fd5b5') // Regular smart contract bytecode

      const result = await isSmartContractWallet('1', toBeHex('0x1', 20))

      expect(result).toBe(true)
    })

    it('should return false for EIP-7702 delegated accounts', async () => {
      const eip7702Code = EIP_7702_DELEGATED_ACCOUNT_PREFIX + '1234567890abcdef1234567890abcdef12345678'
      getCodeMock.mockResolvedValue(eip7702Code)

      const result = await isSmartContractWallet('1', toBeHex('0x1', 20))

      expect(result).toBe(false)
    })

    it('should return false for EOAs (empty bytecode)', async () => {
      getCodeMock.mockResolvedValue(EMPTY_DATA)

      const result = await isSmartContractWallet('1', toBeHex('0x1', 20))

      expect(result).toBe(false)
    })

    describe('on Tron chains', () => {
      const TRON_SHASTA_CHAIN_ID = '2494104990'

      afterEach(() => {
        jest.useRealTimers()
      })

      it('should return true for smart contracts with a single getCode call (no EIP-7702 check)', async () => {
        getCodeMock.mockResolvedValue('0x608060405234801561001057600080fd5b5')

        const result = await isSmartContractWallet(TRON_SHASTA_CHAIN_ID, toBeHex('0x1', 20))

        expect(result).toBe(true)
        expect(getCodeMock).toHaveBeenCalledTimes(1)
      })

      it('should retry after a fetch failure and return the successful result', async () => {
        jest.useFakeTimers()
        getCodeMock
          .mockRejectedValueOnce(new TypeError('Failed to fetch'))
          .mockResolvedValueOnce('0x608060405234801561001057600080fd5b5')

        const promise = isSmartContractWallet(TRON_SHASTA_CHAIN_ID, toBeHex('0x1', 20))
        await jest.runAllTimersAsync()

        expect(await promise).toBe(true)
        expect(getCodeMock).toHaveBeenCalledTimes(2)
      })

      it('should fall back to EOA when all attempts fail', async () => {
        jest.useFakeTimers()
        getCodeMock.mockRejectedValue(new TypeError('Failed to fetch'))

        const promise = isSmartContractWallet(TRON_SHASTA_CHAIN_ID, toBeHex('0x1', 20))
        await jest.runAllTimersAsync()

        expect(await promise).toBe(false)
        expect(getCodeMock).toHaveBeenCalledTimes(3)
      })
    })
  })

  describe('getSmartContractWalletStatus', () => {
    it('should return "contract" for regular smart contracts (not EIP-7702)', async () => {
      getCodeMock.mockResolvedValue('0x608060405234801561001057600080fd5b5')

      const result = await getSmartContractWalletStatus('1', toBeHex('0x1', 20))

      expect(result).toBe('contract')
    })

    it('should return "eoa" for EOAs (empty bytecode)', async () => {
      getCodeMock.mockResolvedValue(EMPTY_DATA)

      const result = await getSmartContractWalletStatus('1', toBeHex('0x1', 20))

      expect(result).toBe('eoa')
    })

    describe('on Tron chains', () => {
      const TRON_SHASTA_CHAIN_ID = '2494104990'

      afterEach(() => {
        jest.useRealTimers()
      })

      it('should return "contract" for smart contracts', async () => {
        getCodeMock.mockResolvedValue('0x608060405234801561001057600080fd5b5')

        const result = await getSmartContractWalletStatus(TRON_SHASTA_CHAIN_ID, toBeHex('0x1', 20))

        expect(result).toBe('contract')
      })

      it('should return "eoa" for EOAs (empty bytecode)', async () => {
        getCodeMock.mockResolvedValue(EMPTY_DATA)

        const result = await getSmartContractWalletStatus(TRON_SHASTA_CHAIN_ID, toBeHex('0x1', 20))

        expect(result).toBe('eoa')
      })

      it('should return "unknown" instead of silently falling back to "eoa" when all attempts fail', async () => {
        jest.useFakeTimers()
        getCodeMock.mockRejectedValue(new TypeError('Failed to fetch'))

        const promise = getSmartContractWalletStatus(TRON_SHASTA_CHAIN_ID, toBeHex('0x1', 20))
        await jest.runAllTimersAsync()

        expect(await promise).toBe('unknown')
        expect(getCodeMock).toHaveBeenCalledTimes(3)
      })
    })
  })

  describe('isWalletUnlocked', () => {
    afterEach(() => {
      delete (window as { tronLink?: unknown }).tronLink
    })

    it('should return false for TronLink when window.tronLink is absent', async () => {
      const result = await isWalletUnlocked('TronLink')

      expect(result).toBe(false)
    })

    it('should return true for TronLink when tronWeb is ready with a connected address', async () => {
      ;(window as { tronLink?: unknown }).tronLink = {
        tronWeb: { ready: true, defaultAddress: { hex: '41deadbeef' } },
      }

      const result = await isWalletUnlocked('TronLink')

      expect(result).toBe(true)
    })
  })
})
