import omit from 'lodash/omit'
import {
  parseGlobalImportData,
  SAFE_EXPORT_VERSION,
  type ParsedImportData,
} from '@/components/settings/DataManagement/useGlobalImportFileParser'
import type { MigrationPayload } from './decodeMigrationFragment'

/**
 * Runs the decoded payload through the same versioned validator used by the manual
 * Settings -> Data import (checksum validation on address book entries, etc.).
 *
 * `safeApps` is dropped on purpose: it only holds numeric Safe App ids, which are specific to
 * the sending gateway's catalogue and would overwrite valid pins here with ids that mean nothing.
 */
export const parseMigrationPayload = (payload: MigrationPayload): ParsedImportData =>
  parseGlobalImportData({ version: SAFE_EXPORT_VERSION.V3, data: omit(payload, 'safeApps') })
