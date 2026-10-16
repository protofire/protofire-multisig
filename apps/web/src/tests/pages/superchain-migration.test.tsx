import { render } from '@/tests/test-utils'
import SuperchainMigrationPage from '@/pages/superchain-migration'
import { AppRoutes } from '@/config/routes'

const HEADING = 'These networks have moved to Protofire Safe'

describe('SuperchainMigrationPage', () => {
  beforeEach(() => {
    jest.restoreAllMocks()
  })

  it('renders the migration content on an allowed Protofire host', () => {
    jest.spyOn(require('@/hooks/useIsProtofireHost'), 'useIsProtofireHost').mockReturnValue(true)
    const replace = jest.fn()

    const { queryByText, getByRole } = render(<SuperchainMigrationPage />, { routerProps: { replace } })

    expect(queryByText(HEADING)).toBeTruthy()
    expect(getByRole('link', { name: 'Open Protofire Safe' })).toHaveAttribute('href', AppRoutes.welcome.index)
    expect(replace).not.toHaveBeenCalled()
  })

  it('redirects to 404 on a disallowed host', () => {
    jest.spyOn(require('@/hooks/useIsProtofireHost'), 'useIsProtofireHost').mockReturnValue(false)
    const replace = jest.fn()

    const { queryByText } = render(<SuperchainMigrationPage />, { routerProps: { replace } })

    expect(queryByText(HEADING)).toBeNull()
    expect(replace).toHaveBeenCalledWith(AppRoutes['404'])
  })

  it('renders nothing and does not redirect while the host check is pending', () => {
    jest.spyOn(require('@/hooks/useIsProtofireHost'), 'useIsProtofireHost').mockReturnValue(undefined)
    const replace = jest.fn()

    const { queryByText } = render(<SuperchainMigrationPage />, { routerProps: { replace } })

    expect(queryByText(HEADING)).toBeNull()
    expect(replace).not.toHaveBeenCalled()
  })
})
