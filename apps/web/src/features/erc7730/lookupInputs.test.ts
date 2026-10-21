import { faker } from '@faker-js/faker'
import type { TypedData as GatewayTypedData } from '@safe-global/store/gateway/AUTO_GENERATED/messages'
import type { TransactionData } from '@safe-global/store/gateway/AUTO_GENERATED/transactions'
import { Operation } from '@safe-global/store/gateway/types'
import type { ClearSigningLookupEntry } from './ClearSigningLookupContext'
import { isRevokedAttestation } from './erc8176/attestation'
import {
  getClearSigningEntryLabel,
  getClearSigningLookupKey,
  getClearSigningTypedDataLookupKey,
  toClearSigningTransaction,
  toClearSigningTypedData,
} from './lookupInputs'

const createGatewayTypedData = (): GatewayTypedData => ({
  domain: {
    chainId: 1,
    name: 'Permit2',
    verifyingContract: faker.finance.ethereumAddress(),
    version: '1',
  },
  primaryType: 'PermitTransferFrom',
  types: {
    EIP712Domain: [
      { name: 'name', type: 'string' },
      { name: 'chainId', type: 'uint256' },
      { name: 'verifyingContract', type: 'address' },
    ],
    PermitTransferFrom: [
      { name: 'permitted', type: 'TokenPermissions' },
      { name: 'spender', type: 'address' },
      { name: 'nonce', type: 'uint256' },
      { name: 'deadline', type: 'uint256' },
    ],
    TokenPermissions: [
      { name: 'token', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
  },
  message: {
    permitted: {
      token: faker.finance.ethereumAddress(),
      amount: '1000',
    },
    spender: faker.finance.ethereumAddress(),
    nonce: '0',
    deadline: '9999999999',
  },
})

describe('getClearSigningLookupKey', () => {
  it('builds a stable key from call fields', () => {
    const key = getClearSigningLookupKey('1', {
      to: { value: '0xabc' },
      operation: Operation.CALL,
      value: '0',
      hexData: '0xdeadbeef',
    })

    expect(key).toBe('1:0xabc:0:0:0xdeadbeef')
  })
})

describe('getClearSigningTypedDataLookupKey', () => {
  it('builds a stable key from the typed-data payload', () => {
    const key = getClearSigningTypedDataLookupKey('1', {
      account: '0xsafe',
      domain: { chainId: 1, verifyingContract: '0xverifier' },
      primaryType: 'Permit',
      types: {},
      message: { value: '1' },
    })

    expect(key).toBe('1:0xsafe:1:0xverifier:Permit:{"value":"1"}')
  })
})

describe('getClearSigningEntryLabel', () => {
  const doneEntry = (patch: Partial<ClearSigningLookupEntry>): ClearSigningLookupEntry => ({
    label: 'Contract call',
    eligible: true,
    status: 'done',
    outcome: 'found',
    ...patch,
  })

  it.each([
    ['attested', 'Descriptor found'],
    ['unattested', 'Descriptor found'],
    ['revoked', 'Descriptor found - revoked'],
  ] as const)('labels a found descriptor with a %s attestation', (status, label) => {
    const attestation =
      status === 'attested'
        ? { status, attester: { address: faker.finance.ethereumAddress(), attestationPath: 'sigs/x.json' } }
        : { status }

    expect(getClearSigningEntryLabel(doneEntry({ attestation }))).toBe(label)
  })

  it('ignores the attestation when no descriptor was found', () => {
    expect(getClearSigningEntryLabel(doneEntry({ outcome: 'not_found', attestation: { status: 'revoked' } }))).toBe(
      'No descriptor',
    )
  })

  it('labels loading and idle entries', () => {
    expect(getClearSigningEntryLabel(doneEntry({ status: 'loading' }))).toBe('Looking up…')
    expect(getClearSigningEntryLabel(doneEntry({ status: 'idle', outcome: undefined }))).toBeUndefined()
  })
})

describe('isRevokedAttestation', () => {
  it('flags only revoked attestations', () => {
    expect(isRevokedAttestation(undefined)).toBe(false)
    expect(isRevokedAttestation({ status: 'unattested' })).toBe(false)
    expect(isRevokedAttestation({ status: 'revoked' })).toBe(true)
  })
})

describe('toClearSigningTransaction', () => {
  it('maps gateway tx data to a clear-signing transaction', () => {
    const to = faker.finance.ethereumAddress()
    const from = faker.finance.ethereumAddress()
    const txData = {
      to: { value: to },
      hexData: '0xa9059cbb',
      value: '1000',
      operation: Operation.CALL,
    } as TransactionData

    expect(toClearSigningTransaction('100', from, txData)).toEqual({
      chainId: 100,
      from,
      to,
      data: '0xa9059cbb',
      value: 1000n,
    })
  })

  it('defaults missing calldata and value', () => {
    const txData = { to: { value: faker.finance.ethereumAddress() }, operation: Operation.CALL } as TransactionData

    expect(toClearSigningTransaction('1', faker.finance.ethereumAddress(), txData)).toMatchObject({
      data: '',
      value: undefined,
    })
  })
})

describe('toClearSigningTypedData', () => {
  it('maps gateway typed data and strips EIP712Domain from types', () => {
    const account = faker.finance.ethereumAddress()
    const gatewayMessage = createGatewayTypedData()

    const result = toClearSigningTypedData(account, gatewayMessage)

    expect(result.account).toBe(account)
    expect(result.primaryType).toBe(gatewayMessage.primaryType)
    expect(result.domain.chainId).toBe(1)
    expect(result.types.EIP712Domain).toBeUndefined()
    expect(result.types.PermitTransferFrom).toBeDefined()
    expect(result.message).toEqual(gatewayMessage.message)
  })
})
