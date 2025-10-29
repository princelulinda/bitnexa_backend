import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'users'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.boolean('is_email_verified').defaultTo(false)
      table.string('email_verification_token').nullable().unique()
      table.timestamp('email_verification_token_expires_at').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('is_email_verified')
      table.dropColumn('email_verification_token')
      table.dropColumn('email_verification_token_expires_at')
    })
  }
}
