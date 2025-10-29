import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'transactions'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table
        .enum('status', [
          'pending',
          'pending_blockchain_confirmation',
          'completed',
          'failed',
          'rejected',
          'pending_admin_approval',
          'processing_withdrawal',
        ])
        .notNullable()
        .defaultTo('pending')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('status')
    })
    this.schema.alterTable(this.tableName, (table) => {
      table.string('status').notNullable().defaultTo('pending') // Revert to string if needed, or drop entirely
    })
  }
}
