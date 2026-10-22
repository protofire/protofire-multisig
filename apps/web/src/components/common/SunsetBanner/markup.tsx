import { Fragment, type ReactNode } from 'react'
import ExternalLink from '@/components/common/ExternalLink'

const TOKEN_REGEX = /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)\s]+)\)|\n/g
const SAFE_URL_REGEX = /^https:\/\//

export const renderMarkup = (text: string): ReactNode[] => {
  const nodes: ReactNode[] = []
  let cursor = 0

  for (const match of text.matchAll(TOKEN_REGEX)) {
    const [token, bold, linkText, href] = match
    const index = match.index ?? 0

    if (index > cursor) nodes.push(text.slice(cursor, index))

    if (bold) nodes.push(<b key={index}>{bold}</b>)
    else if (linkText && SAFE_URL_REGEX.test(href)) {
      nodes.push(
        <ExternalLink key={index} href={href}>
          {linkText}
        </ExternalLink>,
      )
    } else if (token === '\n') nodes.push(<br key={index} />)
    else nodes.push(token)

    cursor = index + token.length
  }

  if (cursor < text.length) nodes.push(text.slice(cursor))

  return nodes.map((node, i) => <Fragment key={i}>{node}</Fragment>)
}
