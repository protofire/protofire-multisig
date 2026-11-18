import { ImplementationVersionState } from '@safe-global/store/gateway/types'
import { render, screen } from '@/tests/test-utils'
import { getOwnersCheck, getVersionCheck, type HealthCheck } from '../../services/checks'
import SafeHealthList from '.'

const SAFE_QUERY = 'eth:0x0000000000000000000000000000000000000001'
const routerProps = { query: { safe: SAFE_QUERY } }

const okChecks: HealthCheck[] = [
  getOwnersCheck(3, 2),
  getVersionCheck('1.4.1', '1.4.1', true, false, ImplementationVersionState.UP_TO_DATE),
  { id: 'modules', state: 'none', status: 'ok', title: 'Safe modules', summary: 'No Safe modules enabled' },
  { id: 'guard', state: 'none', status: 'ok', title: 'Transaction guard', summary: 'No transaction guard set' },
  { id: 'fallbackHandler', state: 'known', status: 'ok', title: 'Fallback handler', summary: 'Known handler' },
  { id: 'recovery', state: 'set_up', status: 'ok', title: 'Account recovery', summary: 'Set up' },
]

const mixedChecks: HealthCheck[] = [getOwnersCheck(1, 1), ...okChecks.slice(1)]

describe('SafeHealthList', () => {
  describe('home', () => {
    it('collapses to one line when every check is ok', () => {
      render(<SafeHealthList checks={okChecks} variant="home" />, { routerProps })

      expect(screen.getByText('Safe setup')).toBeInTheDocument()
      expect(screen.getByText('All 6 checks set')).toBeInTheDocument()
      expect(screen.getByText('View all in Settings')).toBeInTheDocument()
      expect(screen.queryByText('Contract version')).not.toBeInTheDocument()
    })

    it('shows one row per check otherwise', () => {
      render(<SafeHealthList checks={mixedChecks} variant="home" />, { routerProps })

      expect(screen.queryByText(/All 6 checks set/)).not.toBeInTheDocument()
      expect(screen.getByText('1 out of 1 signer must confirm')).toBeInTheDocument()
      expect(screen.getByText('Contract version')).toBeInTheDocument()
      expect(screen.getByText('Account recovery')).toBeInTheDocument()
    })

    it('does not collapse when the mastercopy is unsupported', () => {
      const unsupported = getVersionCheck('1.4.1', '1.4.1', true, false, ImplementationVersionState.UNKNOWN)
      render(<SafeHealthList checks={[...okChecks.slice(0, 1), unsupported, ...okChecks.slice(2)]} variant="home" />, {
        routerProps,
      })

      expect(screen.queryByText(/All 6 checks set/)).not.toBeInTheDocument()
      expect(screen.getByText('Unsupported contract version')).toBeInTheDocument()
    })

    it('hides the version row when hideVersion is set', () => {
      render(<SafeHealthList checks={mixedChecks} variant="home" hideVersion />, { routerProps })

      expect(screen.queryByText('Contract version')).not.toBeInTheDocument()
      expect(screen.getByText('Signers and threshold')).toBeInTheDocument()
    })

    it('links each row to its settings page with the safe query', () => {
      render(<SafeHealthList checks={mixedChecks} variant="home" />, { routerProps })

      const link = screen.getByText('Account recovery').closest('a')
      expect(link?.getAttribute('href')).toContain('/settings/security')
      expect(link?.getAttribute('href')).toContain('safe=')
    })
  })

  describe('settings', () => {
    it('shows all rows with details, even when hideVersion is set', () => {
      render(<SafeHealthList checks={mixedChecks} variant="settings" hideVersion />, { routerProps })

      expect(screen.getByText('Contract version')).toBeInTheDocument()
      expect(screen.getByText('Add a signer so you keep access if this key is lost.')).toBeInTheDocument()
    })

    it('shows the footer', () => {
      render(<SafeHealthList checks={okChecks} variant="settings" />, { routerProps })

      expect(
        screen.getByText(
          'Not checked here: owner type (EOA or contract), module guard, creation factory, multichain setup, pending queue.',
        ),
      ).toBeInTheDocument()
    })

    it('links the row title to its section with the safe query', () => {
      render(<SafeHealthList checks={mixedChecks} variant="settings" />, { routerProps })

      const href = screen.getByText('Safe modules').closest('a')?.getAttribute('href')
      expect(href).toContain('/settings/modules')
      expect(href).toContain('safe=')
    })
  })
})
