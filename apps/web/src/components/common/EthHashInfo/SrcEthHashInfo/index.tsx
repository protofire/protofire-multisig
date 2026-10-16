import classnames from 'classnames'
import type { ReactElement, ReactNode, SyntheticEvent } from 'react'
import { isAddress } from 'ethers'
import { useTheme } from '@mui/material/styles'
import { Box, SvgIcon, Tooltip } from '@mui/material'
import AddressBookIcon from '@/public/images/sidebar/address-book.svg'
import CloudOutlinedIcon from '@mui/icons-material/CloudOutlined'
import useMediaQuery from '@mui/material/useMediaQuery'
import Identicon from '../../Identicon'
import CopyAddressButton from '../../CopyAddressButton'
import ExplorerButton, { type ExplorerButtonProps } from '../../ExplorerButton'
import { shortenAddress } from '@safe-global/utils/utils/formatters'
import ImageFallback from '../../ImageFallback'
import css from './styles.module.css'
import { ContactSource } from '@/hooks/useAllAddressBooks'
import useTronAddress from '@/hooks/useTronAddress'

export type EthHashInfoProps = {
  address: string
  chainId?: string
  name?: string | null
  showAvatar?: boolean
  onlyName?: boolean
  showCopyButton?: boolean
  prefix?: string
  showPrefix?: boolean
  copyPrefix?: boolean
  shortAddress?: boolean
  copyAddress?: boolean
  customAvatar?: string | null
  hasExplorer?: boolean
  avatarSize?: number
  children?: ReactNode
  trusted?: boolean
  ExplorerButtonProps?: ExplorerButtonProps
  addressBookNameSource?: ContactSource
  highlight4bytes?: boolean
  badgeTooltip?: ReactNode
}

const stopPropagation = (e: SyntheticEvent) => e.stopPropagation()

const SrcEthHashInfo = ({
  address,
  chainId,
  customAvatar,
  prefix = '',
  copyPrefix = true,
  showPrefix = true,
  shortAddress = true,
  copyAddress = true,
  showAvatar = true,
  onlyName = false,
  avatarSize,
  name,
  showCopyButton,
  hasExplorer,
  ExplorerButtonProps,
  children,
  trusted = true,
  addressBookNameSource,
  highlight4bytes = false,
  badgeTooltip,
}: EthHashInfoProps): ReactElement => {
  const shouldPrefix = isAddress(address)
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const identicon = <Identicon address={address} size={avatarSize} />
  const shouldCopyPrefix = shouldPrefix && copyPrefix

  // Convert 0x address to Tron base58 for display on Tron chains
  const { displayAddress, copyAddress: tronCopyAddress, isTron } = useTronAddress(address, chainId)

  const accountStylesWithBadge = badgeTooltip
    ? {
        backgroundColor: 'var(--color-background-main)',
        fontWeight: 'bold',
        borderRadius: '16px',
        padding: name ? '2px 8px 2px 6px' : undefined,
      }
    : undefined

  const shownAddress = isTron ? displayAddress : address
  const copyAddr = isTron ? tronCopyAddress : address

  const highlightedAddress = highlight4bytes ? (
    <>
      {shownAddress.slice(0, 2)}
      <b>{shownAddress.slice(2, 6)}</b>
      {shownAddress.slice(6, -4)}
      <b>{shownAddress.slice(-4)}</b>
    </>
  ) : (
    shownAddress
  )

  const addressElement = (
    <>
      {showPrefix && shouldPrefix && prefix && !isTron && <b>{prefix}:</b>}
      <span>{shortAddress || isMobile ? shortenAddress(shownAddress) : highlightedAddress}</span>
    </>
  )

  return (
    <div className={css.container}>
      {showAvatar && (
        <div
          className={css.avatarContainer}
          style={avatarSize !== undefined ? { width: `${avatarSize}px`, height: `${avatarSize}px` } : undefined}
        >
          {customAvatar ? (
            <ImageFallback src={customAvatar} fallbackComponent={identicon} width={avatarSize} height={avatarSize} />
          ) : (
            identicon
          )}
        </div>
      )}

      <Box overflow="hidden" className={onlyName ? css.inline : undefined} gap={0.5}>
        {!!name ? (
          <Box
            title={name}
            className="ethHashInfo-name"
            display="flex"
            alignItems="center"
            gap={0.5}
            sx={accountStylesWithBadge}
          >
            <Box overflow="hidden" textOverflow="ellipsis">
              {name}
            </Box>

            {badgeTooltip
              ? badgeTooltip
              : !!addressBookNameSource && (
                  <Tooltip title={`From your ${addressBookNameSource} address book`} placement="top">
                    <span style={{ lineHeight: 0 }}>
                      <SvgIcon
                        component={addressBookNameSource === ContactSource.local ? AddressBookIcon : CloudOutlinedIcon}
                        inheritViewBox
                        color="border"
                        fontSize="small"
                      />
                    </span>
                  </Tooltip>
                )}
          </Box>
        ) : (
          badgeTooltip && (
            <Box display="flex" alignItems="center" gap={0.5}>
              {badgeTooltip}
            </Box>
          )
        )}

        <div className={classnames(css.addressContainer, { [css.inline]: onlyName })}>
          {(!onlyName || !name) && (
            <Box fontWeight="inherit" fontSize="inherit" overflow="hidden" textOverflow="ellipsis">
              {copyAddress ? (
                <CopyAddressButton
                  prefix={prefix}
                  address={copyAddr}
                  copyPrefix={shouldCopyPrefix && !isTron}
                  trusted={trusted}
                >
                  {addressElement}
                </CopyAddressButton>
              ) : (
                addressElement
              )}
            </Box>
          )}

          {showCopyButton && (
            <CopyAddressButton
              prefix={prefix}
              address={copyAddr}
              copyPrefix={shouldCopyPrefix && !isTron}
              trusted={trusted}
            />
          )}

          {hasExplorer && ExplorerButtonProps && (
            <Box color="border.main">
              <ExplorerButton {...ExplorerButtonProps} onClick={stopPropagation} />
            </Box>
          )}

          {children}
        </div>
      </Box>
    </div>
  )
}

export default SrcEthHashInfo
