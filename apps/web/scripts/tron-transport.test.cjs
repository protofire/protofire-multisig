const { test } = require('node:test')
const assert = require('node:assert/strict')
const { TronWeb } = require('tronweb')
const { encodeFunctionData, parseAbi } = require('viem')
const { tronWebTransport } = require('@dewpointlabs/viem-tron')

const from = '0x' + '11'.repeat(20)
const to = '0x' + '22'.repeat(20)
const encode = (signature, functionName, args) => encodeFunctionData({ abi: parseAbi([signature]), functionName, args })
const cases = [
  ['multiSend', encode('function multiSend(bytes)', 'multiSend', ['0xdeadbeef1234'])],
  ['approveHash', encode('function approveHash(bytes32)', 'approveHash', ['0x' + 'aa'.repeat(32)])],
  [
    'execTransaction',
    encode(
      'function execTransaction(address,uint256,bytes,uint8,uint256,uint256,uint256,address,address,bytes)',
      'execTransaction',
      [to, 0n, '0xdeadbeef1234', 0, 0n, 0n, 0n, from, from, '0x'],
    ),
  ],
  ['unknown selector', '0xdeadbeef' + 'aa'.repeat(32)],
]

function harness() {
  const tw = new TronWeb({ fullHost: 'http://localhost:1' })
  tw.setAddress(tw.address.fromHex('41' + from.slice(2)))
  const getArgs = tw.transactionBuilder._getTriggerSmartContractArgs.bind(tw.transactionBuilder)
  const built = []
  // Use TronWeb's real encoding, stopping before every network boundary.
  tw.transactionBuilder.triggerSmartContract = async (contract, selector, options, params, sender) => {
    const args = getArgs(
      contract,
      selector,
      options,
      params,
      sender,
      undefined,
      undefined,
      options.callValue ?? 0,
      options.feeLimit,
    )
    built.push(args)
    // The node answers with the fee limit on raw_data and the permission id on the contract entry.
    const { fee_limit, Permission_id, ...value } = args
    return {
      result: { result: true },
      transaction: {
        txID: 'ab'.repeat(32),
        raw_data: { contract: [{ type: 'TriggerSmartContract', parameter: { value }, Permission_id }], fee_limit },
      },
    }
  }
  const simulated = []
  tw.transactionBuilder.triggerConstantContract = async (contract, selector, options) => {
    simulated.push(options)
    return { result: { result: true } }
  }
  let signCalls = 0
  tw.trx.sign = async () => {
    signCalls++
    throw new Error('LOCAL SIGNING BOUNDARY')
  }
  tw.trx.sendRawTransaction = async () => {
    throw new Error('Broadcast must never be reached')
  }
  const transport = tronWebTransport(tw, { rpc: 'http://localhost:1' })({ chain: { id: 2494104990 }, retryCount: 0 })
  return {
    built,
    simulated,
    signCalls: () => signCalls,
    send: (data) =>
      transport.request({ method: 'eth_sendTransaction', params: [{ from, to, data, value: '0x7', permissionId: 2 }] }),
  }
}

for (const [name, data] of cases) {
  test(`TronWeb preserves full calldata for ${name}`, async () => {
    const probe = harness()
    await assert.rejects(probe.send(data), /LOCAL SIGNING BOUNDARY/)
    assert.equal(probe.built[0].data, data.slice(2))
    assert.equal(probe.built[0].call_value, 7)
    assert.equal(probe.built[0].Permission_id, 2)
    assert.deepEqual(probe.simulated, [{ input: data.slice(2), callValue: 7, permissionId: 2 }])
    assert.equal(probe.signCalls(), 1)
  })
}
