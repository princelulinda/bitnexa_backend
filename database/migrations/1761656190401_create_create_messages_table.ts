import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'messages' // Correct table name

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary() // UUID primary key
      table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE') // Foreign key to users table
      table.text('content').notNullable() // Message content
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
