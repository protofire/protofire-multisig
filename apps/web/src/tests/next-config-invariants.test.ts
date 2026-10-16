import { readFileSync } from 'fs'
import { join } from 'path'

// Asserted against the source text rather than an import: next.config.mjs is ESM with top-level
// await and pulls in the PWA/MDX/rspack plugin chain, none of which survives the Jest transform.
const source = readFileSync(join(__dirname, '..', '..', 'next.config.mjs'), 'utf-8')

const getImagesBlock = (): string => {
  const match = source.match(/images:\s*\{[^}]*\}/)
  if (!match) throw new Error('Could not locate the `images` block in next.config.mjs')
  return match[0]
}

describe('next.config.mjs security invariants', () => {
  it('builds the app as a static export', () => {
    expect(source).toMatch(/output:\s*'export'/)
  })

  it('keeps the image optimizer disabled', () => {
    expect(getImagesBlock()).toMatch(/unoptimized:\s*true/)
  })

  it.each(['formats', 'remotePatterns', 'domains', 'loader'])(
    'does not configure images.%s, which would expose the optimizer',
    (option) => {
      expect(getImagesBlock()).not.toMatch(new RegExp(`${option}:`))
    },
  )
})
