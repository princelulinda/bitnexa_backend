import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'messages' // Target the existing messages table

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.uuid('parent_id').nullable().references('id').inTable('messages').onDelete('SET NULL')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('parent_id')
    })
  }
}
