import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'deposit_addresses'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()')) // Changed to UUID for consistency and added default UUID generation
      table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE') // Changed to UUID
      table.string('currency').notNullable()
      table.string('network').notNullable()
      table.string('address').notNullable().unique()
      table.boolean('is_active').notNullable().defaultTo(true)
      table.unique(['user_id', 'currency', 'network'])

      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
