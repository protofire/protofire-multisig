import { useCallback, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { Box } from '@mui/material'
import classNames from 'classnames'
import css from './styles.module.css'

type ScrollableChainListProps = {
  children: ReactNode
  maxHeight: number
  layout?: 'wrap' | 'grid'
  columns?: number
  centered?: boolean
  bordered?: boolean
  /** Grow to fill the remaining height of a flex column parent; maxHeight acts as the minimum */
  fill?: boolean
  /** CSS color the bottom fade blends into. Defaults to the paper background. */
  fadeColor?: string
  className?: string
  'data-testid'?: string
}

const ScrollableChainList = ({
  children,
  maxHeight,
  layout = 'wrap',
  columns = 3,
  centered = false,
  bordered = false,
  fill = false,
  fadeColor,
  className,
  'data-testid': testId,
}: ScrollableChainListProps) => {
  const ref = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const [isOverflowing, setIsOverflowing] = useState(false)
  const [isAtEnd, setIsAtEnd] = useState(true)

  const update = useCallback(() => {
    const el = ref.current
    if (!el) return

    setIsOverflowing(el.scrollHeight > el.clientHeight + 1)
    setIsAtEnd(el.scrollTop + el.clientHeight >= el.scrollHeight - 1)
  }, [])

  useLayoutEffect(() => {
    update()

    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(update)
    if (ref.current) observer.observe(ref.current)
    if (contentRef.current) observer.observe(contentRef.current)
    return () => observer.disconnect()
  }, [update])

  const style = {
    '--scrollable-chain-list-max-height': `${maxHeight}px`,
    '--scrollable-chain-list-columns': columns,
    ...(fadeColor ? { '--scrollable-chain-list-fade': fadeColor } : {}),
  } as CSSProperties

  return (
    <Box
      ref={ref}
      data-testid={testId}
      data-overflowing={isOverflowing && !isAtEnd}
      onScroll={update}
      style={style}
      className={classNames(css.scrollable, css.scrollbar, bordered && css.bordered, fill && css.fill, className)}
    >
      <Box
        ref={contentRef}
        className={classNames(layout === 'grid' ? css.grid : css.content, centered && css.centered)}
      >
        {children}
      </Box>
    </Box>
  )
}

export { css as scrollableChainListCss }
export default ScrollableChainList
