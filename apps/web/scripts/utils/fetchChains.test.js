import { fetchAllChains } from './fetchChains'

const jsonResponse = (body) => ({ ok: true, status: 200, statusText: 'OK', json: async () => body })

describe('fetchAllChains', () => {
  it('follows the next cursor until every page is consumed', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse({ results: [{ chainId: '1' }], next: 'https://gw/page2' }))
      .mockResolvedValueOnce(jsonResponse({ results: [{ chainId: '4441' }], next: null }))

    expect(await fetchAllChains('https://gw', fetchImpl)).toEqual([{ chainId: '1' }, { chainId: '4441' }])

    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(fetchImpl).toHaveBeenNthCalledWith(1, 'https://gw/v1/chains?cursor=limit%3D40%26offset%3D0')
    expect(fetchImpl).toHaveBeenNthCalledWith(2, 'https://gw/page2')
  })

  it('stops on a page without a next cursor', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse({ results: [{ chainId: '1' }] }))

    expect(await fetchAllChains('https://gw', fetchImpl)).toEqual([{ chainId: '1' }])
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('throws on a failed request', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({ ok: false, status: 500, statusText: 'Server Error' })

    await expect(fetchAllChains('https://gw', fetchImpl)).rejects.toThrow('500 Server Error')
  })

  it('throws instead of looping forever on a self-referencing cursor', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse({ results: [], next: 'https://gw/page2' }))

    await expect(fetchAllChains('https://gw', fetchImpl)).rejects.toThrow('not terminating')
  })
})
