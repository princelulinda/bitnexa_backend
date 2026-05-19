import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'p2p_payment_methods'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.db.rawQuery('gen_random_uuid()').knexQuery)
      table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
      table.string('type', 50).notNullable()        // e.g. "Bank Transfer", "PayPal", "MTN Mobile Money"
      table.string('label', 100).notNullable()       // display name set by user
      table.jsonb('details').notNullable().defaultTo('{}') // account number, email, phone, etc.
      table.boolean('is_active').notNullable().defaultTo(true)
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()
    })
    this.schema.raw('CREATE INDEX idx_p2p_pm_user ON p2p_payment_methods(user_id)')
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
