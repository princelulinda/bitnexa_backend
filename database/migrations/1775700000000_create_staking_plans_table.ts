import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'staking_plans'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary()
      table.string('token').notNullable() // ETH | SOL
      table.integer('duration_days').notNullable()
      table.decimal('apy_percent', 5, 2).notNullable()
      table.decimal('min_amount', 18, 2).defaultTo(10)
      table.boolean('is_active').defaultTo(true)
      table.timestamps(true, true)
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
