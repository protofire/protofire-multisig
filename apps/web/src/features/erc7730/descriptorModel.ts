import type { DisplayModel, Warning, WarningCode } from '@ethereum-sourcify/clear-signing'
import { ERC7730_REGISTRY_SOURCE_BLOB_BASE } from '@/config/constants.extra'

const HIDDEN_WARNING_CODES = new Set<WarningCode>(['UNKNOWN_ADDRESS', 'UNKNOWN_CHAIN'])

export const getVisibleWarning = (warning: Warning | undefined): Warning | undefined =>
  warning && !HIDDEN_WARNING_CODES.has(warning.code) ? warning : undefined

export const getVisibleWarnings = (warnings: Warning[] | undefined): Warning[] =>
  (warnings ?? []).filter((warning) => getVisibleWarning(warning) !== undefined)

export const assertClearSigningModelLoaded = (model: DisplayModel): DisplayModel => {
  const fetchError = model.warnings?.find(({ code }) => code === 'DESCRIPTOR_FETCH_ERROR')
  if (fetchError) {
    throw new Error(fetchError.message)
  }
  return model
}

export const shouldShowClearSigningModel = (model: DisplayModel | undefined): model is DisplayModel => {
  if (!model || model.rawCalldataFallback) {
    return false
  }

  return Boolean(model.interpolatedIntent || model.intent || (model.fields && model.fields.length > 0))
}

export const getDescriptorOwnerUrl = (model: DisplayModel): string | undefined => {
  const url = model.metadata?.owner ? model.metadata.info?.url : undefined
  if (!url) {
    return undefined
  }

  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' ? parsed.href : undefined
  } catch {
    return undefined
  }
}

export const getDescriptorSourceUrl = (descriptorPath?: string): string | undefined =>
  descriptorPath ? `${ERC7730_REGISTRY_SOURCE_BLOB_BASE}/${descriptorPath.replace(/^\//, '')}` : undefined
