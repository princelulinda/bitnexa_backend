import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'transactions'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary() // Changed to UUID for consistency
      table.uuid('wallet_id').references('id').inTable('wallets').onDelete('CASCADE') // Changed to UUID
      table.decimal('amount', 18, 8).notNullable()
      table.string('type').notNullable() // deposit, withdrawal, investment, signal_gain, principal_return, referral_bonus, weekly_salary
      table.string('description').nullable()
      table
        .uuid('related_subscription_id') // Changed to UUID
        .references('id')
        .inTable('subscriptions')
        .onDelete('SET NULL')
        .nullable()

      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
