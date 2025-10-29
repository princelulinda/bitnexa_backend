import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'deposit_addresses'

  async up() {
    // Rename the table to 'deposits'
    this.schema.renameTable(this.tableName, 'deposits')

    this.schema.alterTable('deposits', (table) => {
      // Add new columns
      table.decimal('expected_amount', 18, 8).notNullable().defaultTo(0)
      table.string('status', 50).notNullable().defaultTo('pending') // e.g., pending, completed, expired
      table.timestamp('expires_at', { useTz: true }).nullable()

      // Remove the old column
      table.dropColumn('is_active')
    })
  }

  async down() {
    this.schema.alterTable('deposits', (table) => {
      table.dropColumn('expected_amount')
      table.dropColumn('status')
      table.dropColumn('expires_at')

      table.boolean('is_active').notNullable().defaultTo(true)
    })

    // Rename back to 'deposit_addresses'
    this.schema.renameTable('deposits', this.tableName)
  }
}
