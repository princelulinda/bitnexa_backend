import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'wallets'

  async up() {
    // Use raw to safely add columns only if they don't exist
    await this.db.rawQuery(`
      ALTER TABLE wallets
        ADD COLUMN IF NOT EXISTS locked_capital DECIMAL(18,2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS withdrawal_unlock_level INTEGER NULL
    `)
  }

  async down() {
    await this.db.rawQuery(`
      ALTER TABLE wallets
        DROP COLUMN IF EXISTS locked_capital,
        DROP COLUMN IF EXISTS withdrawal_unlock_level
    `)
  }
}
