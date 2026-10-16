import type MigrationHandshake from './components/MigrationHandshake'

export interface DataMigrationContract {
  // Component (PascalCase) - stub renders null
  MigrationHandshake: typeof MigrationHandshake
}
