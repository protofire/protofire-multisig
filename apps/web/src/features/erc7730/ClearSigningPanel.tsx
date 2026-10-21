import {
  isFieldGroup,
  type DisplayField,
  type DisplayFieldGroup,
  type DisplayModel,
  type EmbeddedCalldata,
  type Warning,
} from '@ethereum-sourcify/clear-signing'
import { Accordion, AccordionDetails, AccordionSummary, Alert, Box, Stack, Tooltip, Typography } from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { sameAddress } from '@safe-global/utils/utils/addresses'
import classnames from 'classnames'
import type { ReactElement, ReactNode } from 'react'
import ExternalLink from '@/components/common/ExternalLink'
import EthHashInfo from '@/components/common/EthHashInfo'
import { ERC7730_EVENTS, trackEvent } from '@/services/analytics'
import accordionCss from '@/styles/accordion.module.css'
import type { ClearSigningLookupResultData } from './ClearSigningLookupContext'
import { isRevokedAttestation, REVOKED_WARNING, type ClearSigningAttestation } from './erc8176/attestation'
import { AttestationStatus, AttestationWarning } from './erc8176/AttestationStatus'
import { getDescriptorOwnerUrl, getDescriptorSourceUrl, getVisibleWarning, getVisibleWarnings } from './descriptorModel'
import { isClearSigningNativeTokenAddress } from './externalDataProvider'
import { ClearSigningPill, FieldGrid } from './primitives'
import css from './styles.module.css'

export const clearSigningAccordionClassName = css.accordion

const CHIP_TOOLTIP = 'ERC-7730 descriptor available for this call'

export const ClearSigningFoundChip = ({ attestation }: { attestation?: ClearSigningAttestation }): ReactElement => {
  const warning = isRevokedAttestation(attestation) ? REVOKED_WARNING : undefined

  return (
    <Tooltip title={warning ? `${CHIP_TOOLTIP}, but ${warning.tooltip}` : CHIP_TOOLTIP} arrow>
      <span data-testid="erc7730-check-hint" className={css.chipWrapper}>
        <ClearSigningPill className={warning && css.pillWarning}>
          ERC-7730
          <span className={css.chipSuffix}> found{warning && ` - ${warning.label}`}</span>
        </ClearSigningPill>
      </span>
    </Tooltip>
  )
}

const ClearSigningOwnerTag = ({ owner, url }: { owner: string; url?: string }): ReactElement => {
  const className = classnames(css.accent, css.ownerTag)

  if (url) {
    return (
      <ExternalLink href={url} data-testid="clear-signing-owner-link" className={className}>
        {owner}
      </ExternalLink>
    )
  }

  return (
    <Typography component="span" variant="body2" data-testid={`clear-signing-owner-tag-${owner}`} className={className}>
      {owner}
    </Typography>
  )
}

const ClearSigningTxAccordion = ({
  summaryTags = [],
  headerAction,
  children,
}: {
  summaryTags?: string[]
  headerAction?: ReactNode
  children: ReactNode
}): ReactElement => (
  <Box className={css.panel} data-testid="erc7730-clear-signing-panel">
    <Accordion className={css.accordion} defaultExpanded elevation={0}>
      <AccordionSummary
        data-testid="clear-signing-tx-summary"
        expandIcon={<ExpandMoreIcon />}
        className={accordionCss.accordion}
      >
        <div className={css.summaryRow}>
          <Typography variant="subtitle2" fontWeight={700} className={css.summaryTitle}>
            Clear signing
          </Typography>

          <div className={css.summaryTags}>
            {summaryTags.map((tag) => (
              <ClearSigningPill key={tag} testId={`clear-signing-summary-tag-${tag}`}>
                {tag}
              </ClearSigningPill>
            ))}
            {headerAction && (
              <span
                className={css.headerAction}
                onClick={(event) => event.stopPropagation()}
                onKeyDown={(event) => event.stopPropagation()}
              >
                {headerAction}
              </span>
            )}
          </div>
        </div>
      </AccordionSummary>

      <AccordionDetails data-testid="clear-signing-tx-details">{children}</AccordionDetails>
    </Accordion>
  </Box>
)

const formatIntent = (model: DisplayModel): string | undefined => {
  if (model.interpolatedIntent) {
    return model.interpolatedIntent
  }
  if (typeof model.intent === 'string') {
    return model.intent
  }
  if (model.intent) {
    return Object.entries(model.intent)
      .map(([key, value]) => `${key}: ${value}`)
      .join(' · ')
  }
  return undefined
}

const getClearSigningSummary = (
  model: DisplayModel,
): { intent: string | undefined; summaryTags: string[]; showIntentInBody: boolean } => {
  const intent = formatIntent(model)
  const summaryTags = model.metadata?.contractName ? [model.metadata.contractName] : intent ? [intent] : []
  return {
    intent,
    summaryTags,
    showIntentInBody: Boolean(intent && !summaryTags.includes(intent)),
  }
}

const getDecodedEmbeddedCall = (field: DisplayField): EmbeddedCalldata | undefined =>
  field.embeddedCalldata && !field.embeddedCalldata.display.rawCalldataFallback ? field.embeddedCalldata : undefined

const FieldWarning = ({ message }: { message: string }): ReactElement => (
  <Typography variant="caption" color="warning.main" component="div">
    {message}
  </Typography>
)

const WarningList = ({ warnings }: { warnings: Warning[] | undefined }): ReactElement | null => {
  const visibleWarnings = getVisibleWarnings(warnings)
  if (visibleWarnings.length === 0) {
    return null
  }

  return (
    <Alert severity="warning" className={css.warnings}>
      {visibleWarnings.map((warning, index) => (
        <Typography key={`${warning.code}-${index}`} variant="body2" component="div">
          {warning.message}
        </Typography>
      ))}
    </Alert>
  )
}

const IntentField = ({ intent }: { intent: string }): ReactElement => (
  <FieldGrid label="Intent">
    <Typography variant="body2" fontWeight={700} component="div" className={css.fieldValue}>
      {intent}
    </Typography>
  </FieldGrid>
)

const RawAddress = ({ address }: { address: string }): ReactElement => (
  <Typography variant="body2" color="text.secondary" component="div" className={css.fieldValue}>
    <EthHashInfo address={address} showAvatar={false} showCopyButton hasExplorer shortAddress={false} />
  </Typography>
)

const ValueWithAddress = ({ value, address }: { value: string; address: string }): ReactElement => (
  <Stack direction="row" alignItems="center" columnGap={1} flexWrap="wrap" className={css.fieldValue}>
    <Typography variant="body2" component="span">
      {value}
    </Typography>
    <Typography variant="body2" color="text.secondary" component="span">
      <EthHashInfo
        address={address}
        showAvatar={false}
        showPrefix={false}
        showName={false}
        showCopyButton
        hasExplorer
        shortAddress
      />
    </Typography>
  </Stack>
)

function ClearSigningEmbeddedCall({ embedded }: { embedded: EmbeddedCalldata }): ReactElement {
  const intent = formatIntent(embedded.display)

  return (
    <Stack spacing={1} className={css.embeddedCall}>
      {intent && <IntentField intent={intent} />}
      {embedded.callee && <RawAddress address={embedded.callee} />}
      {embedded.display.fields && embedded.display.fields.length > 0 && (
        <ClearSigningFields fields={embedded.display.fields} />
      )}
      <WarningList warnings={embedded.display.warnings} />
    </Stack>
  )
}

function ClearSigningFieldRow({ field }: { field: DisplayField }): ReactElement {
  const embeddedCall = getDecodedEmbeddedCall(field)
  const warning = getVisibleWarning(field.warning)
  const rawAddress = field.rawAddress && !sameAddress(field.rawAddress, field.value) ? field.rawAddress : undefined
  const tokenAddress =
    field.tokenAddress && !isClearSigningNativeTokenAddress(field.tokenAddress) ? field.tokenAddress : undefined
  const inlineAddress = tokenAddress ?? rawAddress

  const valueContent = embeddedCall ? (
    <ClearSigningEmbeddedCall embedded={embeddedCall} />
  ) : inlineAddress ? (
    <ValueWithAddress value={field.value} address={inlineAddress} />
  ) : (
    <Typography variant="body2" component="div" className={css.fieldValue}>
      {field.value}
    </Typography>
  )

  return (
    <Stack spacing={0.5} className={css.fieldRow}>
      {field.separator && (
        <Typography variant="caption" color="text.secondary" component="div">
          {field.separator}
        </Typography>
      )}
      <FieldGrid label={field.label}>{valueContent}</FieldGrid>
      {warning && <FieldWarning message={warning.message} />}
    </Stack>
  )
}

function ClearSigningFieldGroup({ group }: { group: DisplayFieldGroup }): ReactElement {
  const warning = getVisibleWarning(group.warning)

  return (
    <Stack spacing={0.75} className={group.label ? css.group : undefined}>
      {group.label && (
        <Typography variant="body2" color="text.secondary" fontWeight={600}>
          {group.label}
        </Typography>
      )}
      {warning && <FieldWarning message={warning.message} />}
      {group.fields.map((field, index) => (
        <ClearSigningFieldRow key={index} field={field} />
      ))}
    </Stack>
  )
}

function ClearSigningFields({ fields }: { fields: (DisplayField | DisplayFieldGroup)[] }): ReactElement {
  return (
    <Stack spacing={1}>
      {fields.map((field, index) =>
        isFieldGroup(field) ? (
          <ClearSigningFieldGroup key={index} group={field} />
        ) : (
          <ClearSigningFieldRow key={index} field={field} />
        ),
      )}
    </Stack>
  )
}

export const ClearSigningPanel = ({
  model,
  descriptorPath,
  attestation,
}: ClearSigningLookupResultData & { model: DisplayModel }): ReactElement => {
  const { intent, summaryTags, showIntentInBody } = getClearSigningSummary(model)
  const owner = model.metadata?.owner
  const ownerUrl = getDescriptorOwnerUrl(model)
  const sourceUrl = getDescriptorSourceUrl(descriptorPath)

  const showIntentRow = showIntentInBody || Boolean(owner)

  return (
    <ClearSigningTxAccordion
      summaryTags={summaryTags}
      headerAction={
        sourceUrl ? (
          <ExternalLink
            href={sourceUrl}
            data-testid="erc7730-source-link"
            className={classnames(css.accent, css.sourceLink)}
            onClick={() => trackEvent(ERC7730_EVENTS.SOURCE_LINK_CLICKED)}
          >
            ERC-7730 source
          </ExternalLink>
        ) : undefined
      }
    >
      <Stack spacing={2}>
        <AttestationWarning attestation={attestation} />

        {showIntentRow && (
          <Stack
            direction="row"
            justifyContent={showIntentInBody ? 'space-between' : 'flex-end'}
            alignItems="center"
            gap={1}
            className={css.shrinkable}
          >
            {showIntentInBody && intent && (
              <Box className={css.shrinkable} flex={1} minWidth={0}>
                <IntentField intent={intent} />
              </Box>
            )}
            {owner && <ClearSigningOwnerTag owner={owner} url={ownerUrl} />}
          </Stack>
        )}

        {model.fields && model.fields.length > 0 && <ClearSigningFields fields={model.fields} />}

        <AttestationStatus attestation={attestation} />

        <WarningList warnings={model.warnings} />

        <Typography variant="caption" color="text.secondary" data-testid="erc7730-registry-disclaimer">
          BETA: From the public ERC-7730 registry. This does not verify the transaction.
        </Typography>
      </Stack>
    </ClearSigningTxAccordion>
  )
}
