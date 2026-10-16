import { SvgIcon, Typography } from '@mui/material'
import { useLazySafesGetSafeV1Query } from '@safe-global/store/gateway/AUTO_GENERATED/safes'
import { useState, useEffect } from 'react'
import { useWatch } from 'react-hook-form'
import { isAddress } from 'ethers'
import type { ReactElement } from 'react'

import InfoIcon from '@/public/images/notifications/info.svg'
import { getSmartContractWalletStatus, type SmartContractWalletStatus } from '@/utils/wallets'
import useDebounce from '@safe-global/utils/hooks/useDebounce'
import useSafeInfo from '@/hooks/useSafeInfo'
import { UpsertRecoveryFlowFields } from '.'
import { sameAddress } from '@safe-global/utils/utils/addresses'

import addressBookInputCss from '@/components/common/AddressBookInput/styles.module.css'

export function RecovererWarning(): ReactElement | null {
  const { safe, safeAddress } = useSafeInfo()
  const [warning, setWarning] = useState<string>()
  const [triggerGetSafe] = useLazySafesGetSafeV1Query()

  const recoverer = useWatch({ name: UpsertRecoveryFlowFields.recoverer })
  const debouncedRecoverer = useDebounce(recoverer, 500)

  useEffect(() => {
    setWarning(undefined)

    if (!isAddress(debouncedRecoverer) || sameAddress(debouncedRecoverer, safeAddress)) {
      return
    }

    ;(async () => {
      let status: SmartContractWalletStatus

      try {
        status = await getSmartContractWalletStatus(safe.chainId, debouncedRecoverer)
      } catch {
        return
      }

      // Confirmed EOA
      if (status === 'eoa') {
        return
      }

      // 'contract' or 'unknown' — fail closed and don't assume it can sign transactions
      try {
        await triggerGetSafe({ chainId: safe.chainId, safeAddress: debouncedRecoverer }).unwrap()
      } catch {
        setWarning(
          status === 'unknown'
            ? 'Could not verify whether the given address is a smart contract. Please ensure that it can sign transactions.'
            : 'The given address is a smart contract. Please ensure that it can sign transactions.',
        )
      }
    })()
  }, [debouncedRecoverer, safe.chainId, safeAddress, triggerGetSafe])

  if (!warning) {
    return null
  }

  return (
    <Typography
      variant="body2"
      className={addressBookInputCss.unknownAddress}
      sx={({ palette }) => ({
        bgcolor: `${palette.warning.background} !important`,
        color: `${palette.warning.main} !important`,
      })}
    >
      <SvgIcon component={InfoIcon} fontSize="small" />
      {warning}
    </Typography>
  )
}
