import { createAssociateTokenTx, createDissociateTokenTx } from '../associateTokenParams'
import { HTS_PRECOMPILE_ADDRESS } from '@/utils/hedera'

describe('createAssociateTokenTx', () => {
  it('should build a MetaTransactionData targeting the HTS precompile', () => {
    const tx = createAssociateTokenTx(
      '0x3dddce646712500ab55e1b2d6e61de4c409f50ef',
      '0x00000000000000000000000000000000000b2ad5',
    )

    expect(tx.to).toBe(HTS_PRECOMPILE_ADDRESS)
    expect(tx.to).toBe('0x0000000000000000000000000000000000000167')
    expect(tx.value).toBe('0')
  })

  it('should encode calldata matching a live-observed associateToken(account, token) call exactly', () => {
    // Live-observed Safe transaction (this session): a Safe associating token 0.0.731861
    // (long-zero address 0x...b2ad5) with itself.
    const tx = createAssociateTokenTx(
      '0x3dddce646712500ab55e1b2d6e61de4c409f50ef',
      '0x00000000000000000000000000000000000b2ad5',
    )

    expect(tx.data).toBe(
      '0x49146bde' +
        '0000000000000000000000003dddce646712500ab55e1b2d6e61de4c409f50ef' +
        '00000000000000000000000000000000000000000000000000000000000b2ad5',
    )
  })
})

describe('createDissociateTokenTx', () => {
  it('should build a MetaTransactionData targeting the HTS precompile', () => {
    const tx = createDissociateTokenTx(
      '0x3dddce646712500ab55e1b2d6e61de4c409f50ef',
      '0x00000000000000000000000000000000000b2ad5',
    )

    expect(tx.to).toBe(HTS_PRECOMPILE_ADDRESS)
    expect(tx.value).toBe('0')
  })

  it('should encode calldata for dissociateToken(account, token) with the correct HTS selector', () => {
    const tx = createDissociateTokenTx(
      '0x3dddce646712500ab55e1b2d6e61de4c409f50ef',
      '0x00000000000000000000000000000000000b2ad5',
    )

    expect(tx.data).toBe(
      '0x099794e8' +
        '0000000000000000000000003dddce646712500ab55e1b2d6e61de4c409f50ef' +
        '00000000000000000000000000000000000000000000000000000000000b2ad5',
    )
  })
})
