import { faker } from '@faker-js/faker'
import { getAddress } from 'ethers'
import { http, HttpResponse, type JsonBodyType } from 'msw'
import { server } from '@/tests/server'
import { logError } from '@/services/exceptions'
import { createBaseUrl, CYFRIN_ATTESTER } from '../testHelpers'
import { getAttesterProfile, withAttesterProfile } from './attesterProfile'

jest.mock('@/services/exceptions', () => ({
  ...jest.requireActual<Record<string, unknown>>('@/services/exceptions'),
  logError: jest.fn(),
}))

const PROFILE_PATH = `auditors/eip155-1-${CYFRIN_ATTESTER}/profile.json`
const cyfrinProfile = { id: `eip155:1:${CYFRIN_ATTESTER}`, name: 'Patrick Collins', organization: 'Cyfrin' }

const mockProfile = (baseUrl: string, body: JsonBodyType, status = 200, onRequest?: () => void) =>
  server.use(
    http.get(`${baseUrl}/${PROFILE_PATH}`, () => {
      onRequest?.()
      return status === 200 ? HttpResponse.json(body) : new HttpResponse(null, { status })
    }),
  )

describe('getAttesterProfile', () => {
  it('fetches the profile under auditors/ using the checksummed address', async () => {
    const baseUrl = createBaseUrl()
    mockProfile(baseUrl, { ...cyfrinProfile, ens: 'cyfrin.eth' })

    await expect(getAttesterProfile(baseUrl, CYFRIN_ATTESTER.toLowerCase())).resolves.toEqual({
      name: 'Patrick Collins',
      organization: 'Cyfrin',
      ens: 'cyfrin.eth',
    })
  })

  it('accepts a profile whose id differs only by address case', async () => {
    const baseUrl = createBaseUrl()
    mockProfile(baseUrl, { id: `eip155:1:${CYFRIN_ATTESTER.toLowerCase()}`, name: 'Patrick Collins' })

    await expect(getAttesterProfile(baseUrl, CYFRIN_ATTESTER)).resolves.toEqual({ name: 'Patrick Collins' })
  })

  it('resolves to undefined when no profile is published', async () => {
    const baseUrl = createBaseUrl()
    mockProfile(baseUrl, null, 404)

    await expect(getAttesterProfile(baseUrl, CYFRIN_ATTESTER)).resolves.toBeUndefined()
    expect(logError).not.toHaveBeenCalled()
  })

  it.each([
    ['the id belongs to another address', { ...cyfrinProfile, id: `eip155:1:${faker.finance.ethereumAddress()}` }],
    ['the name is missing', { id: cyfrinProfile.id, organization: 'Cyfrin' }],
    ['the organization is not a string', { ...cyfrinProfile, organization: 42 }],
    ['the ens is not a string', { ...cyfrinProfile, ens: ['cyfrin.eth'] }],
    ['the body is not an object', ['Cyfrin']],
  ])('ignores a profile when %s', async (_, body) => {
    const baseUrl = createBaseUrl()
    mockProfile(baseUrl, body)

    await expect(getAttesterProfile(baseUrl, CYFRIN_ATTESTER)).resolves.toBeUndefined()
  })

  it('logs and resolves to undefined when the fetch fails', async () => {
    const baseUrl = createBaseUrl()
    mockProfile(baseUrl, null, 503)

    await expect(getAttesterProfile(baseUrl, CYFRIN_ATTESTER)).resolves.toBeUndefined()
    expect(logError).toHaveBeenCalledWith(expect.stringContaining('822'), expect.any(Error))
  })

  it('fetches a profile once per registry and attester', async () => {
    const baseUrl = createBaseUrl()
    const onRequest = jest.fn()
    mockProfile(baseUrl, cyfrinProfile, 200, onRequest)

    await Promise.all([getAttesterProfile(baseUrl, CYFRIN_ATTESTER), getAttesterProfile(baseUrl, CYFRIN_ATTESTER)])
    await getAttesterProfile(baseUrl, CYFRIN_ATTESTER.toLowerCase())

    expect(onRequest).toHaveBeenCalledTimes(1)
  })
})

describe('withAttesterProfile', () => {
  const attester = { address: CYFRIN_ATTESTER, attestationPath: `registry/weth/sigs/calldata-weth.json` }

  it('merges the profile into an attested result', async () => {
    const baseUrl = createBaseUrl()
    mockProfile(baseUrl, cyfrinProfile)

    await expect(withAttesterProfile(baseUrl, { attestation: { status: 'attested', attester } })).resolves.toEqual({
      attestation: {
        status: 'attested',
        attester: { ...attester, name: 'Patrick Collins', organization: 'Cyfrin', ens: undefined },
      },
    })
  })

  it('returns the result unchanged when there is no profile', async () => {
    const baseUrl = createBaseUrl()
    mockProfile(baseUrl, null, 404)
    const result = { attestation: { status: 'attested' as const, attester } }

    await expect(withAttesterProfile(baseUrl, result)).resolves.toBe(result)
  })

  it('does not fetch anything when the result has no attester', async () => {
    const result = { attestation: { status: 'unattested' as const } }
    const other = getAddress(faker.finance.ethereumAddress())

    await expect(withAttesterProfile(`https://${other}.invalid`, result)).resolves.toBe(result)
  })
})
