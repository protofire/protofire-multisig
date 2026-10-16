import { Box } from '@mui/material'
import classnames from 'classnames'
import { useCallback, useEffect, useRef, useState } from 'react'
import CheckIcon from '@/public/images/common/circle-check.svg'
import { SpinnerStatus } from '@/components/new-safe/create/steps/StatusStep/LoadingSpinner'
import css from '@/components/new-safe/create/steps/StatusStep/LoadingSpinnerCheck/styles.module.css'

export { SpinnerStatus }

const COLLAPSE_DURATION_MS = 800
const COLLAPSE_TRANSFORM = 'translateX(30px) translateY(30px) scale(1)'

const isCssAnimation = (animation: Animation): animation is CSSAnimation => 'animationName' in animation

const supportsAnimations = (element: HTMLDivElement | null): element is HTMLDivElement =>
  typeof element?.animate === 'function'

const collapse = (element: HTMLDivElement): Promise<unknown> => {
  const cssAnimations = element.getAnimations().filter(isCssAnimation)
  cssAnimations.forEach((animation) => animation.pause())
  const transformStart = window.getComputedStyle(element).transform
  cssAnimations.forEach((animation) => animation.cancel())

  return element.animate([{ transform: transformStart }, { transform: COLLAPSE_TRANSFORM }], {
    duration: COLLAPSE_DURATION_MS,
    easing: 'ease-out',
    fill: 'forwards',
  }).finished
}

const LoadingSpinnerCheck = ({ status }: { status: SpinnerStatus }) => {
  const isError = status === SpinnerStatus.ERROR
  const isSuccess = status === SpinnerStatus.SUCCESS
  const [isCollapsed, setIsCollapsed] = useState(false)

  const rectTl = useRef<HTMLDivElement>(null)
  const rectTr = useRef<HTMLDivElement>(null)
  const rectBl = useRef<HTMLDivElement>(null)
  const rectBr = useRef<HTMLDivElement>(null)

  const onFinish = useCallback(() => {
    const rects = [rectTl.current, rectTr.current, rectBl.current, rectBr.current].filter(supportsAnimations)
    if (rects.length === 0) return

    Promise.all(rects.map(collapse))
      .then(() => setIsCollapsed(true))
      .catch(() => undefined) // animations reject when cancelled on unmount
  }, [])

  useEffect(() => {
    if (isSuccess) {
      onFinish()
    }
  }, [isSuccess, onFinish])

  return (
    <Box
      className={classnames(css.box, {
        [css.rectError]: isError,
        [css.rectSuccess]: isSuccess,
        [css.collapsed]: isCollapsed,
      })}
    >
      <div className={classnames(css.rect, css.rectTl)} ref={rectTl} />
      <div className={classnames(css.rect, css.rectTr)} ref={rectTr} />
      <div className={classnames(css.rect, css.rectBl)} ref={rectBl} />
      <div className={classnames(css.rect, css.rectBr)} ref={rectBr} />
      <div className={classnames(css.rect, css.rectCenter)} />
      <CheckIcon className={css.check} aria-hidden />

      <svg xmlns="http://www.w3.org/2000/svg" version="1.1">
        <defs>
          <filter id="gooey">
            <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
            <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 19 -9" result="goo" />
            <feComposite in="SourceGraphic" in2="goo" operator="atop" />
          </filter>
        </defs>
      </svg>
    </Box>
  )
}

export default LoadingSpinnerCheck
