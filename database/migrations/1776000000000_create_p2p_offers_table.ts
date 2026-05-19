import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'p2p_offers'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.db.rawQuery('gen_random_uuid()').knexQuery)
      table.uuid('seller_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
      table.decimal('amount', 18, 2).notNullable()
      table.decimal('price_per_unit', 18, 2).notNullable()
      table.string('fiat_currency', 10).notNullable()
      table.jsonb('payment_methods').notNullable().defaultTo('[]')
      table.string('status', 20).notNullable().defaultTo('open')
        // open | locked | completed | cancelled
      table.text('notes').nullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()
    })
    this.schema.raw('CREATE INDEX idx_p2p_offers_status ON p2p_offers(status)')
    this.schema.raw('CREATE INDEX idx_p2p_offers_seller ON p2p_offers(seller_id)')
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
