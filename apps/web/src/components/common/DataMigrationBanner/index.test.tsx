import { faker } from '@faker-js/faker'
import * as nextRouter from 'next/router'
import { render, screen } from '@/tests/test-utils'
import { chainBuilder } from '@/tests/builders/chains'
import * as useChains from '@/hooks/useChains'
import * as useSafeAddress from '@/hooks/useSafeAddress'
import { AppRoutes } from '@/config/routes'
import DataMigrationBanner from './index'

const safeAddress = faker.finance.ethereumAddress()

const mockRouter = (pathname: string) =>
  jest.spyOn(nextRouter, 'useRouter').mockReturnValue({ pathname, query: {} } as never)

const mockChain = (chainId: string, shortName: string) =>
  jest.spyOn(useChains, 'useCurrentChain').mockReturnValue(chainBuilder().with({ chainId, shortName }).build())

describe('DataMigrationBanner', () => {
  beforeEach(() => {
    mockRouter(AppRoutes.home)
    mockChain('13371', 'imx')
    jest.spyOn(useSafeAddress, 'default').mockReturnValue(safeAddress)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('links to the open Safe on Protofire Multisig', () => {
    render(<DataMigrationBanner />)

    expect(screen.getByText('Immutable Safe is moving to Protofire Multisig.')).toBeInTheDocument()
    expect(screen.getByTestId('data-migration-cta')).toHaveAttribute(
      'href',
      `https://app.safe.protofire.io/home?safe=imx:${safeAddress}`,
    )
  })

  it('is not dismissible', () => {
    render(<DataMigrationBanner />)

    expect(screen.getByTestId('data-migration-cta')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /close/i })).not.toBeInTheDocument()
  })

  it('renders nothing on the testnet', () => {
    mockChain('13473', 'imx-testnet')

    render(<DataMigrationBanner />)

    expect(screen.queryByTestId('data-migration-cta')).not.toBeInTheDocument()
  })

  it('renders nothing outside the dashboard', () => {
    mockRouter(AppRoutes.welcome.accounts)

    render(<DataMigrationBanner />)

    expect(screen.queryByTestId('data-migration-cta')).not.toBeInTheDocument()
  })

  it('renders nothing when no Safe is open', () => {
    jest.spyOn(useSafeAddress, 'default').mockReturnValue('')

    render(<DataMigrationBanner />)

    expect(screen.queryByTestId('data-migration-cta')).not.toBeInTheDocument()
  })
})
