import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'plans'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('name').notNullable()
      table.text('description').nullable()
      table.integer('duration_days').notNullable()
      table.decimal('min_amount', 14, 2).notNullable()
      table.decimal('max_amount', 14, 2).notNullable()
      table.boolean('is_active').defaultTo(true)
      table.integer('signals_per_day').notNullable()
      table.decimal('gain_multiplier', 8, 6).notNullable()

      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
