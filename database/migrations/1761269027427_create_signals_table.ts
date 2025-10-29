import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'signals'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.integer('plan_id').unsigned().references('id').inTable('plans').onDelete('CASCADE')
      table.string('status').notNullable() // successful, failed
      table.text('description').nullable()
      table.dateTime('processed_at').nullable()

      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
