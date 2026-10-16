import type { Meta, StoryObj } from '@storybook/react'
import { withMockProvider } from '@/storybook/preview'
import { ImportErrors } from '@/components/settings/DataManagement/useGlobalImportFileParser'
import MigrationConfirmDialog from './index'

const meta = {
  title: 'Features/DataMigration/MigrationConfirmDialog',
  component: MigrationConfirmDialog,
  parameters: {
    layout: 'fullscreen',
  },
  decorators: [withMockProvider()],
  tags: ['autodocs'],
} satisfies Meta<typeof MigrationConfirmDialog>

export default meta

type Story = StoryObj<typeof meta>

export const WithData: Story = {
  args: {
    data: {
      addressBookEntriesCount: 2,
      addedSafesCount: 1,
      addressBook: { '1': { '0xAecDFD3A19f777F0c03e6bf99AAfB59937d6467b': 'Alice' } },
      addedSafes: {
        '1': { '0xAecDFD3A19f777F0c03e6bf99AAfB59937d6467b': { owners: [], threshold: 1 } },
      },
      settings: undefined,
      safeApps: undefined,
      undeployedSafes: undefined,
      visitedSafes: undefined,
    },
  },
}

export const NoImportableData: Story = {
  args: {
    data: {
      addressBookEntriesCount: 0,
      addedSafesCount: 0,
      addressBook: undefined,
      addedSafes: undefined,
      settings: undefined,
      safeApps: undefined,
      undeployedSafes: undefined,
      visitedSafes: undefined,
      error: ImportErrors.NO_IMPORT_DATA_FOUND,
    },
  },
}
