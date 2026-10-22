import { render, screen } from '@testing-library/react'
import { renderMarkup } from './markup'

const renderText = (text: string) => render(<p>{renderMarkup(text)}</p>)

describe('renderMarkup', () => {
  it('renders plain text', () => {
    renderText('Hello world')

    expect(screen.getByText('Hello world')).toBeInTheDocument()
  })

  it('renders bold text', () => {
    renderText('Go to **Settings** now')

    expect(screen.getByText('Settings').tagName).toBe('B')
  })

  it('renders https links as safe external links', () => {
    renderText('Visit [Protofire](https://app.safe.protofire.io)')

    const link = screen.getByRole('link', { name: 'Protofire' })
    expect(link).toHaveAttribute('href', 'https://app.safe.protofire.io')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noreferrer noopener')
  })

  it.each(['javascript:alert(1)', 'http://insecure.example', 'data:text/html,hi'])(
    'does not render a link for %s',
    (href) => {
      renderText(`[click](${href})`)

      expect(screen.queryByRole('link')).not.toBeInTheDocument()
    },
  )

  it('renders line breaks', () => {
    const { container } = renderText('one\ntwo')

    expect(container.querySelectorAll('br')).toHaveLength(1)
  })

  it('does not interpret HTML', () => {
    const { container } = renderText('<script>alert(1)</script>')

    expect(container.querySelector('script')).toBeNull()
    expect(container).toHaveTextContent('<script>alert(1)</script>')
  })
})
