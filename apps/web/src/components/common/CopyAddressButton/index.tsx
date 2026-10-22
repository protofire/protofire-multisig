import { checksumAddress } from '@safe-global/utils/utils/addresses'
import { normalizeRskChecksum } from '@safe-global/utils/utils/rsk-utils'
import { Box, Typography } from '@mui/material'
import type { ReactNode, ReactElement } from 'react'
import CopyButton from '../CopyButton'
import EthHashInfo from '../EthHashInfo'

const CopyAddressButton = ({
  prefix,
  address,
  copyPrefix,
  children,
  trusted = true,
}: {
  prefix?: string
  address: string
  copyPrefix?: boolean
  children?: ReactNode
  trusted?: boolean
}): ReactElement => {
  const addressText = copyPrefix && prefix ? `${prefix}:${address}` : address

  // The copied address can be in the EIP-1191 form on Rootstock, the dialog needs the EIP-55 one
  const checksummedAddress = checksumAddress(address ? normalizeRskChecksum(address) : address)

  const dialogContent = trusted ? undefined : (
    <Box display="flex" flexDirection="column" gap={2}>
      <EthHashInfo
        address={checksummedAddress}
        shortAddress={false}
        copyAddress={false}
        showCopyButton={false}
        hasExplorer
      />
      <Typography>
        The copied address is linked to a transaction with an untrusted token. Make sure you are interacting with the
        right address.
      </Typography>
    </Box>
  )

  return (
    <CopyButton text={addressText} dialogContent={dialogContent}>
      {children}
    </CopyButton>
  )
}

export default CopyAddressButton
