import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactElement,
  type ReactNode,
} from 'react'
import { Box, Paper, Popper } from '@mui/material'
import type { Chain } from '@safe-global/store/gateway/AUTO_GENERATED/chains'
import ChainIndicator from '@/components/common/ChainIndicator'
import ScrollableChainList from '@/components/common/ScrollableChainList'

const CLOSE_DELAY_MS = 150

type NetworksPopoverProps = {
  networks: Pick<Chain, 'chainId'>[]
  children: ReactNode
}

const NetworksPopover = ({ networks, children }: NetworksPopoverProps): ReactElement => {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => () => clearTimeout(closeTimer.current), [])

  const open = (event?: { currentTarget: HTMLElement }) => {
    clearTimeout(closeTimer.current)
    if (event) setAnchorEl(event.currentTarget)
  }

  const scheduleClose = () => {
    clearTimeout(closeTimer.current)
    closeTimer.current = setTimeout(() => setAnchorEl(null), CLOSE_DELAY_MS)
  }

  const closeNow = () => {
    clearTimeout(closeTimer.current)
    setAnchorEl(null)
  }

  const onKeyDown = (event: ReactKeyboardEvent) => {
    if (event.key === 'Escape') closeNow()
  }

  return (
    <>
      <Box
        data-testid="network-list"
        tabIndex={0}
        aria-haspopup="true"
        aria-expanded={Boolean(anchorEl)}
        onKeyDown={onKeyDown}
        sx={{ display: 'inline-block' }}
        onMouseEnter={open}
        onMouseLeave={scheduleClose}
        onFocus={open}
        onBlur={scheduleClose}
      >
        {children}
      </Box>
      <Popper
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        placement="bottom-end"
        sx={{ zIndex: (theme) => theme.zIndex.tooltip }}
      >
        <Paper
          data-testid="network-list-popover"
          onKeyDown={onKeyDown}
          onMouseEnter={() => open()}
          onMouseLeave={scheduleClose}
          sx={{ mt: 1, p: 2, width: 420, maxWidth: '90vw', boxShadow: 3 }}
        >
          <ScrollableChainList layout="grid" columns={3} maxHeight={240}>
            {networks.map(({ chainId }) => (
              <ChainIndicator key={chainId} chainId={chainId} inline />
            ))}
          </ScrollableChainList>
        </Paper>
      </Popper>
    </>
  )
}

export default NetworksPopover
