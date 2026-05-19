import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'p2p_trade_messages'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.db.rawQuery('gen_random_uuid()').knexQuery)
      table.uuid('trade_id').notNullable().references('id').inTable('p2p_trades').onDelete('CASCADE')
      table.uuid('sender_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
      table.text('content').nullable()               // text message (null if file-only)
      table.string('file_url', 500).nullable()       // uploaded file URL
      table.string('file_type', 20).nullable()       // 'image' | 'document'
      table.string('message_type', 20).notNullable().defaultTo('text') // text | file | system
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()
    })
    this.schema.raw('CREATE INDEX idx_p2p_msg_trade ON p2p_trade_messages(trade_id)')
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
