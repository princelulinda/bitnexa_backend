import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'users'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      // Drop old columns
      table.dropColumn('email_verification_token')
      table.dropColumn('email_verification_token_expires_at')

      // Add new columns for 6-digit code
      table.string('email_verification_code', 6).nullable()
      table.timestamp('email_verification_code_expires_at').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      // Revert to old columns (for rollback purposes)
      table.dropColumn('email_verification_code')
      table.dropColumn('email_verification_code_expires_at')

      table.string('email_verification_token').nullable()
      table.timestamp('email_verification_token_expires_at').nullable()
    })
  }
}
