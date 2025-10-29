import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'subscriptions'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary() // Changed to UUID for consistency
      table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE') // Changed to UUID
      table.integer('plan_id').unsigned().references('id').inTable('plans').onDelete('SET NULL')
      table.uuid('wallet_id').references('id').inTable('wallets').onDelete('CASCADE') // Changed to UUID
      table.decimal('invested_amount', 18, 8).notNullable()
      table.string('status').notNullable().defaultTo('active') // active, matured, cancelled
      table.dateTime('start_date').notNullable()
      table.dateTime('end_date').notNullable()

      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
