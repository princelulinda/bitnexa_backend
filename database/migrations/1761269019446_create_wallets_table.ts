import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'wallets'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary() // Changed to UUID for consistency
      table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE') // Changed to UUID
      table.decimal('balance', 18, 8).notNullable().defaultTo(0)
      table.string('currency').notNullable()

      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
