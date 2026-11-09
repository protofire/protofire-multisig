import { safenetExplorerTxUrl } from '../safenetExplorerTxUrl'
import { SAFENET_EXPLORER_URL } from '../../constants'

describe('safenetExplorerTxUrl', () => {
  it('builds the explorer deep link from the chain id and the hash', () => {
    const hash = '0x' + 'a'.repeat(64)
    expect(safenetExplorerTxUrl('100', hash)).toBe(`${SAFENET_EXPLORER_URL}/#/safeTx?chainId=100&safeTxHash=${hash}`)
  })

  it('encodes unsafe characters in both parameters', () => {
    expect(safenetExplorerTxUrl('1&2', '0x#1')).toBe(`${SAFENET_EXPLORER_URL}/#/safeTx?chainId=1%262&safeTxHash=0x%231`)
  })
})
