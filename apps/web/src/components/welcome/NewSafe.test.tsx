import { render, screen } from '@/tests/test-utils'
import userEvent from '@testing-library/user-event'
import NewSafe from './NewSafe'

const mockRouter = { isReady: true, pathname: '/welcome', query: {} as Record<string, string>, replace: jest.fn() }

jest.mock('next/router', () => ({ useRouter: () => mockRouter }))
jest.mock('./WelcomeLogin', () => () => null)
jest.mock('./WelcomeRightPanel', () => () => null)
jest.mock('./WelcomeDisclaimer', () => () => null)
jest.mock('../common/Footer', () => () => null)
jest.mock('../common/SunsetBanner', () => () => null)
jest.mock('./WelcomeGreetingDialog', () => {
  const MockGreetingDialog = ({ open, onClose }: { open: boolean; onClose: () => void }) =>
    open ? (
      <div>
        greeting-open
        <button aria-label="close-greeting" onClick={onClose} />
      </div>
    ) : null
  return MockGreetingDialog
})

describe('NewSafe greeting dialog', () => {
  const setRoute = (pathname: string, query: Record<string, string> = {}) => {
    mockRouter.pathname = pathname
    mockRouter.query = query
  }

  it('is closed on the plain welcome page', () => {
    setRoute('/welcome')
    render(<NewSafe />)

    expect(screen.queryByText('greeting-open')).not.toBeInTheDocument()
  })

  it('is open on /welcome/data-migration', () => {
    setRoute('/welcome/data-migration')
    render(<NewSafe />)

    expect(screen.getByText('greeting-open')).toBeInTheDocument()
  })

  it('stays closed on the removed /data-migration route and the ?greeting=true param', () => {
    setRoute('/data-migration')
    const { unmount } = render(<NewSafe />)
    expect(screen.queryByText('greeting-open')).not.toBeInTheDocument()
    unmount()

    setRoute('/welcome', { greeting: 'true' })
    render(<NewSafe />)
    expect(screen.queryByText('greeting-open')).not.toBeInTheDocument()
  })

  it('returns to /welcome when the dialog is closed', async () => {
    setRoute('/welcome/data-migration')
    render(<NewSafe />)

    await userEvent.click(screen.getByRole('button', { name: 'close-greeting' }))

    expect(mockRouter.replace).toHaveBeenCalledWith({ pathname: '/welcome', query: {} }, undefined, { shallow: true })
  })
})
