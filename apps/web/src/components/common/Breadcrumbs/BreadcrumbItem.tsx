import Link from 'next/link'
import type { UrlObject } from 'url'
import { Tooltip, Typography, useMediaQuery, useTheme } from '@mui/material'
import { shortenAddress } from '@safe-global/utils/utils/formatters'
import css from './styles.module.css'
import Identicon from '@/components/common/Identicon'
import { useAddressBookItem } from '@/hooks/useAllAddressBooks'
import useChainId from '@/hooks/useChainId'
import useRootstockAddress from '@/hooks/useRootstockAddress'

export const BreadcrumbItem = ({ title, address, href }: { title: string; address: string; href?: UrlObject }) => {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const chainId = useChainId()
  const addressBookItem = useAddressBookItem(address, chainId)
  const rskAddress = useRootstockAddress(address)
  const name = addressBookItem ? addressBookItem.name : isMobile ? shortenAddress(rskAddress) : rskAddress

  return (
    <Tooltip title={title}>
      <div className={css.breadcrumb}>
        <Identicon address={address} size={20} />
        {href ? (
          <Link href={href}>
            <Typography variant="body2" color="text.secondary">
              {name}
            </Typography>
          </Link>
        ) : (
          <Typography variant="body2">{name}</Typography>
        )}
      </div>
    </Tooltip>
  )
}
