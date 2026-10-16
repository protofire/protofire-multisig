import type { SafeTransaction } from '@safe-global/types-kit'
import { ZERO_ADDRESS } from '@safe-global/protocol-kit/dist/src/utils/constants'
import { feeFields, getEstimatedFee, isSafePaysTx, NO_FEE_FIELDS, type FeePreview } from '../gasTokenFee'

const USDC = '0x036CbD53842c5426634e7929541eC2318f3dCF7e'
const REFUND_RECEIVER = '0x798D0d04E1c52020d298b6246D9A87ceb4C08b36'

const preview = (overrides: Partial<FeePreview['txData']> = {}): FeePreview =>
  ({
    txData: {
      safeTxGas: '39090',
      baseGas: '71500',
      gasPrice: '1',
      gasToken: USDC,
      refundReceiver: REFUND_RECEIVER,
      ...overrides,
    },
  }) as FeePreview

const safeTx = (data: Partial<SafeTransaction['data']>): SafeTransaction =>
  ({ data, signatures: new Map() }) as SafeTransaction

describe('gasTokenFee', () => {
  describe('feeFields', () => {
    it('carries every fee field of the quote, safeTxGas included', () => {
      // The whole quote must survive in one object: dropping any field here silently turns a
      // "Safe pays" transaction back into one the signer pays for.
      expect(feeFields(preview())).toEqual({
        safeTxGas: '39090',
        baseGas: '71500',
        gasPrice: '1',
        gasToken: USDC,
        refundReceiver: REFUND_RECEIVER,
      })
    })
  })

  describe('isSafePaysTx', () => {
    it('is true for a transaction built from a quote', () => {
      expect(isSafePaysTx(safeTx(feeFields(preview())))).toBe(true)
    })

    it('is false once the fee fields are reset to the SDK defaults', () => {
      // Guards the SafeTxProvider regression: a rebuild that drops the fee fields must not keep
      // looking like a Safe-pays transaction.
      expect(isSafePaysTx(safeTx({ ...feeFields(preview()), ...NO_FEE_FIELDS }))).toBe(false)
    })

    it('is false when only gasPrice is zeroed', () => {
      expect(isSafePaysTx(safeTx({ ...feeFields(preview()), gasPrice: '0' }))).toBe(false)
    })

    it('is true for a native fee: gasToken 0x0 with a refund receiver', () => {
      expect(isSafePaysTx(safeTx({ ...feeFields(preview()), gasToken: ZERO_ADDRESS }))).toBe(true)
    })

    it('is false for gasPrice with neither token nor refund receiver (tx.origin refund, not a relay fee)', () => {
      expect(
        isSafePaysTx(safeTx({ ...feeFields(preview()), gasToken: ZERO_ADDRESS, refundReceiver: ZERO_ADDRESS })),
      ).toBe(false)
    })

    it('is false without a transaction', () => {
      expect(isSafePaysTx(undefined)).toBe(false)
    })
  })

  describe('getEstimatedFee', () => {
    it('is (safeTxGas + baseGas) * gasPrice', () => {
      expect(getEstimatedFee(preview())).toBe(110590n)
    })

    it('is zero when the executor pays', () => {
      expect(getEstimatedFee(preview({ gasPrice: '0' }))).toBe(0n)
    })
  })
})
