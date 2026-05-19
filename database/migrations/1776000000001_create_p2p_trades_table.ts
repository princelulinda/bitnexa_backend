import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'p2p_trades'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.db.rawQuery('gen_random_uuid()').knexQuery)
      table.uuid('offer_id').notNullable().references('id').inTable('p2p_offers').onDelete('CASCADE')
      table.uuid('buyer_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
      table.uuid('seller_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
      table.decimal('amount', 18, 2).notNullable()
      table.decimal('price_per_unit', 18, 2).notNullable()
      table.string('fiat_currency', 10).notNullable()
      table.decimal('total_fiat', 18, 2).notNullable()
      table.string('status', 30).notNullable().defaultTo('pending_payment')
        // pending_payment | payment_sent | completed | cancelled | timed_out | disputed | resolved_buyer | resolved_seller
      table.jsonb('payment_proofs').notNullable().defaultTo('[]')
      table.timestamp('paid_at', { useTz: true }).nullable()
      // Dispute fields
      table.uuid('disputed_by').nullable().references('id').inTable('users')
      table.text('dispute_reason').nullable()
      table.uuid('resolved_by').nullable().references('id').inTable('users')
      table.string('resolution_direction', 10).nullable() // buyer | seller
      table.text('resolution_notes').nullable()
      table.timestamp('resolved_at', { useTz: true }).nullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()
    })
    this.schema.raw('CREATE INDEX idx_p2p_trades_buyer ON p2p_trades(buyer_id)')
    this.schema.raw('CREATE INDEX idx_p2p_trades_seller ON p2p_trades(seller_id)')
    this.schema.raw('CREATE INDEX idx_p2p_trades_status ON p2p_trades(status)')
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
