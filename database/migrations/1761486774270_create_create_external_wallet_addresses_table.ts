import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'external_wallet_addresses'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary() // Changed to UUID
      table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE') // Changed to UUID
      table.string('address', 255).notNullable()
      table.string('currency', 50).notNullable()
      table.string('network', 50).notNullable()
      table.string('name', 255).nullable() // User-friendly name for the address

      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())

      // Add a unique constraint to prevent duplicate external addresses for the same user/currency/network
      table.unique(['user_id', 'currency', 'network', 'address'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
