import { render, screen } from '@/tests/test-utils'
import PageLayout from './index'

jest.mock('@/components/common/Header', () => {
  const MockHeader = () => <div data-testid="app-header" />
  return MockHeader
})
jest.mock('./SideDrawer', () => {
  const MockSideDrawer = () => null
  return MockSideDrawer
})
jest.mock('@/components/batch/BatchSidebar', () => {
  const MockBatchSidebar = () => null
  return MockBatchSidebar
})
jest.mock('@/components/common/Breadcrumbs', () => {
  const MockBreadcrumbs = () => null
  return MockBreadcrumbs
})
jest.mock('@/components/common/SunsetBanner', () => {
  const MockSunsetBanner = () => <div data-testid="sunset-banner" />
  return MockSunsetBanner
})
jest.mock('../Footer', () => {
  const MockFooter = () => null
  return MockFooter
})
jest.mock('../SafeLoadingError', () => {
  const MockSafeLoadingError = ({ children }: { children: React.ReactNode }) => <>{children}</>
  return MockSafeLoadingError
})
jest.mock('@/hooks/useIsSidebarRoute', () => ({ useIsSidebarRoute: () => [false, false] }))

describe('PageLayout', () => {
  it.each(['/welcome', '/welcome/data-migration'])('hides the app header and sunset banner on %s', (pathname) => {
    render(
      <PageLayout pathname={pathname}>
        <div>page</div>
      </PageLayout>,
    )

    expect(screen.queryByTestId('app-header')).not.toBeInTheDocument()
    expect(screen.queryByTestId('sunset-banner')).not.toBeInTheDocument()
  })

  it('shows the app header on other pages', () => {
    render(
      <PageLayout pathname="/home">
        <div>page</div>
      </PageLayout>,
    )

    expect(screen.getByTestId('app-header')).toBeInTheDocument()
  })
})
