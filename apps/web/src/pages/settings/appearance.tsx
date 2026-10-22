import { Checkbox, FormControlLabel, FormGroup, Grid, Paper, Typography, Switch } from '@mui/material'
import type { ChangeEvent } from 'react'
import type { NextPage } from 'next'
import Head from 'next/head'

import { useAppDispatch, useAppSelector } from '@/store'
import {
  selectSettings,
  setCopyShortName,
  setDarkMode,
  selectTronAddressFormat,
  setTronAddressFormat,
  selectRootstockAddressChecksum,
  setRootstockAddressChecksum,
} from '@/store/settingsSlice'
import SettingsHeader from '@/components/settings/SettingsHeader'
import { trackEvent, SETTINGS_EVENTS } from '@/services/analytics'
import { useDarkMode } from '@/hooks/useDarkMode'
import ExternalLink from '@/components/common/ExternalLink'
import { BRAND_NAME } from '@/config/constants'
import { useHasFeature } from '@/hooks/useChains'
import { FEATURES } from '@safe-global/utils/utils/chains'

const Appearance: NextPage = () => {
  const dispatch = useAppDispatch()
  const settings = useAppSelector(selectSettings)
  const isDarkMode = useDarkMode()
  const isTron = useHasFeature(FEATURES.TRON) === true
  const tronAddressFormat = useAppSelector(selectTronAddressFormat)
  const isRootstock = useHasFeature(FEATURES.ROOTSTOCK_SUPPORT) === true
  const rootstockAddressChecksum = useAppSelector(selectRootstockAddressChecksum)

  const handleToggle = (
    action: typeof setCopyShortName | typeof setDarkMode | typeof setRootstockAddressChecksum,
    event:
      | typeof SETTINGS_EVENTS.APPEARANCE.COPY_PREFIXES
      | typeof SETTINGS_EVENTS.APPEARANCE.DARK_MODE
      | typeof SETTINGS_EVENTS.APPEARANCE.ROOTSTOCK_CHECKSUM,
  ) => {
    return (_: ChangeEvent<HTMLInputElement>, checked: boolean) => {
      dispatch(action(checked))

      trackEvent({
        ...event,
        label: checked,
      })
    }
  }

  return (
    <>
      <Head>
        <title>{`${BRAND_NAME} – Settings – Appearance`}</title>
      </Head>
      <SettingsHeader />
      <main>
        <Paper sx={{ p: 4 }}>
          <Grid container spacing={3}>
            <Grid item lg={4} xs={12}>
              <Typography
                variant="h4"
                sx={{
                  fontWeight: 'bold',
                  mb: 1,
                }}
              >
                Chain-specific addresses
              </Typography>
            </Grid>

            <Grid item xs>
              <Typography
                sx={{
                  mb: 2,
                }}
              >
                Choose whether to copy{' '}
                <ExternalLink href="https://eips.ethereum.org/EIPS/eip-3770">EIP-3770</ExternalLink> prefixes when
                copying Ethereum addresses.
              </Typography>
              <FormGroup>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={settings.shortName.copy}
                      onChange={handleToggle(setCopyShortName, SETTINGS_EVENTS.APPEARANCE.COPY_PREFIXES)}
                    />
                  }
                  label="Copy addresses with chain prefix"
                />
              </FormGroup>
            </Grid>
          </Grid>

          <Grid
            container
            spacing={3}
            sx={{
              alignItems: 'center',
              marginTop: 2,
            }}
          >
            <Grid item lg={4} xs={12}>
              <Typography
                variant="h4"
                sx={{
                  fontWeight: 'bold',
                }}
              >
                Theme
              </Typography>
            </Grid>

            <Grid item xs>
              <FormControlLabel
                control={
                  <Switch
                    checked={isDarkMode}
                    onChange={handleToggle(setDarkMode, SETTINGS_EVENTS.APPEARANCE.DARK_MODE)}
                  />
                }
                label="Dark mode"
              />
            </Grid>
          </Grid>

          {isTron && (
            <Grid
              container
              spacing={3}
              sx={{
                alignItems: 'center',
                marginTop: 2,
              }}
            >
              <Grid item lg={4} xs={12}>
                <Typography
                  variant="h4"
                  sx={{
                    fontWeight: 'bold',
                  }}
                >
                  Address format
                </Typography>
              </Grid>

              <Grid item xs>
                <FormControlLabel
                  control={
                    <Switch
                      checked={tronAddressFormat === 'base58'}
                      onChange={(_, checked) => dispatch(setTronAddressFormat(checked ? 'base58' : 'hex'))}
                    />
                  }
                  label="Display addresses in Tron format (T...)"
                />
              </Grid>
            </Grid>
          )}

          {isRootstock && (
            <Grid
              container
              spacing={3}
              sx={{
                alignItems: 'center',
                marginTop: 2,
              }}
            >
              <Grid item lg={4} xs={12}>
                <Typography
                  variant="h4"
                  sx={{
                    fontWeight: 'bold',
                  }}
                >
                  Rootstock addresses
                </Typography>
              </Grid>

              <Grid item xs>
                <FormGroup>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={rootstockAddressChecksum}
                        onChange={handleToggle(
                          setRootstockAddressChecksum,
                          SETTINGS_EVENTS.APPEARANCE.ROOTSTOCK_CHECKSUM,
                        )}
                      />
                    }
                    label="Display Rootstock addresses in checksum format (EIP-1191)"
                  />
                </FormGroup>
              </Grid>
            </Grid>
          )}
        </Paper>
      </main>
    </>
  )
}

export default Appearance
