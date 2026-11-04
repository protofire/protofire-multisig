import { http, HttpResponse } from 'msw'
import { server } from '@/tests/server'
import { EXPLORER_FETCH_TIMEOUT_MS, getExplorerApi, getExplorerLogs, type ExplorerApi } from '../explorer-logs'

const API_PARAMS = '?module={{module}}&action={{action}}&address={{address}}&apiKey={{apiKey}}'

const chainWithApi = (api: string, chainId = '1329') => ({
  chainId,
  blockExplorerUriTemplate: { address: '', txHash: '', api },
})

describe('explorer-logs', () => {
  describe('getExplorerApi', () => {
    it.each([
      ['https://hsk.blockscout.com/api', 'https://hsk.blockscout.com/api'],
      ['https://explorer.celo.org/mainnet/api', 'https://explorer.celo.org/mainnet/api'],
      ['https://mizuhiki.blockscout.com/', 'https://mizuhiki.blockscout.com/'],
    ])('should use the API of the template without its placeholders: %s', (base, url) => {
      expect(getExplorerApi(chainWithApi(`${base}${API_PARAMS}`), '')).toEqual({ url, params: {} })
    })

    it('should keep the parameters the template fixes', () => {
      const api =
        'https://api.etherscan.io/v2/api?chainid=4326&module={{module}}&action={{action}}&address={{address}}&apikey={{apiKey}}'

      expect(getExplorerApi(chainWithApi(api), 'key')).toEqual({
        url: 'https://api.etherscan.io/v2/api',
        params: { chainid: '4326', apikey: 'key' },
      })
    })

    it('should fill in the chain ID where the template asks for it', () => {
      const api =
        'https://api.etherscan.io/v2/api?chainid={{chainId}}&module={{module}}&action={{action}}&address={{address}}&apiKey={{apiKey}}'

      expect(getExplorerApi(chainWithApi(api, '1329'), 'key')).toEqual({
        url: 'https://api.etherscan.io/v2/api',
        params: { chainid: '1329', apiKey: 'key' },
      })
    })

    it('should fill in the API key where the template asks for it', () => {
      expect(getExplorerApi(chainWithApi(`https://hsk.blockscout.com/api${API_PARAMS}`), 'key')).toEqual({
        url: 'https://hsk.blockscout.com/api',
        params: { apiKey: 'key' },
      })
    })

    it('should not send an API key the template does not ask for', () => {
      const api = 'https://explorer-api.adifoundation.ai/api?module={{module}}&action={{action}}&address={{address}}'

      expect(getExplorerApi(chainWithApi(api), 'key')).toEqual({
        url: 'https://explorer-api.adifoundation.ai/api',
        params: {},
      })
    })

    it.each([
      ['a malformed', 'https://testnet.sapphire.oasis.dev/api?module={{module}}&apiKey={{apiKey}'],
      ['an unknown', 'https://testnet.sapphire.oasis.dev/api?module={{module}}&network={{network}}'],
    ])('should drop %s placeholder', (_, api) => {
      expect(getExplorerApi(chainWithApi(api), 'key')).toEqual({
        url: 'https://testnet.sapphire.oasis.dev/api',
        params: {},
      })
    })

    it.each([
      ['a REST API', 'https://explorer.goat.network/api/v2/'],
      ['an API without actions', 'https://apilist.tronscan.org/api'],
      ['an invalid URL', 'explorer{{module}}'],
      ['an empty template', ''],
    ])('should not use %s', (_, api) => {
      expect(getExplorerApi(chainWithApi(api), 'key')).toBeNull()
    })

    it('should not use an explorer without a chain', () => {
      expect(getExplorerApi(undefined, 'key')).toBeNull()
    })
  })

  describe('getExplorerLogs', () => {
    const explorer: ExplorerApi = { url: 'https://explorer.test/api', params: { chainid: '1', apikey: 'key' } }
    const log = {
      address: '0x43f51f3066322390797495734ac8838cac17b501',
      topics: ['0x01', '0x02', '0x03', null],
      data: '0x',
      blockNumber: '0x49a77e',
      logIndex: '0x15',
      transactionHash: '0x12ea38d25c7ea846d1d78a4f86db091abc360993d866983d855117686dd253aa',
      transactionIndex: '0xf',
    }

    const respondWith = (response: () => Response) => {
      const requests: Array<URL> = []
      server.use(
        http.get(explorer.url, ({ request }) => {
          requests.push(new URL(request.url))
          return response()
        }),
      )
      return requests
    }

    it('should query the logs of the whole history matching all topics', async () => {
      const requests = respondWith(() => HttpResponse.json({ status: '1', message: 'OK', result: [log] }))

      const logs = await getExplorerLogs(explorer, { address: log.address, topics: ['0x01', '0x02', '0x03'] })

      expect(logs).toEqual([log])
      expect(Object.fromEntries(requests[0].searchParams)).toEqual({
        chainid: '1',
        apikey: 'key',
        module: 'logs',
        action: 'getLogs',
        address: log.address,
        fromBlock: '0',
        toBlock: 'latest',
        topic0: '0x01',
        topic1: '0x02',
        topic2: '0x03',
        topic0_1_opr: 'and',
        topic0_2_opr: 'and',
        topic1_2_opr: 'and',
      })
    })

    it('should return no logs when none are found', async () => {
      respondWith(() => HttpResponse.json({ status: '0', message: 'No records found', result: [] }))

      await expect(getExplorerLogs(explorer, { address: log.address, topics: ['0x01'] })).resolves.toEqual([])
    })

    it('should throw the error the explorer returns in place of the logs', async () => {
      respondWith(() => HttpResponse.json({ status: '0', message: 'NOTOK', result: 'Missing/Invalid API Key' }))

      await expect(getExplorerLogs(explorer, { address: log.address, topics: ['0x01'] })).rejects.toThrow(
        'Block explorer error: Missing/Invalid API Key',
      )
    })

    it('should throw when the explorer fails to respond', async () => {
      respondWith(() => new HttpResponse(null, { status: 503 }))

      await expect(getExplorerLogs(explorer, { address: log.address, topics: ['0x01'] })).rejects.toThrow(
        'Block explorer responded with 503',
      )
    })

    it('should give up when the explorer does not respond in time', async () => {
      const timeout = new DOMException('The operation timed out', 'TimeoutError')
      const timeoutSpy = jest.spyOn(AbortSignal, 'timeout').mockReturnValue(AbortSignal.abort(timeout))
      respondWith(() => HttpResponse.json({ status: '1', message: 'OK', result: [log] }))

      await expect(getExplorerLogs(explorer, { address: log.address, topics: ['0x01'] })).rejects.toThrow(
        'The operation timed out',
      )
      expect(timeoutSpy).toHaveBeenCalledWith(EXPLORER_FETCH_TIMEOUT_MS)

      timeoutSpy.mockRestore()
    })
  })
})
