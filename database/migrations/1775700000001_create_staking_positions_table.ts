import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'staking_positions'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary()
      table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
      table.uuid('staking_plan_id').notNullable().references('id').inTable('staking_plans').onDelete('RESTRICT')
      table.string('token').notNullable() // ETH | SOL
      table.decimal('amount', 18, 2).notNullable()
      table.decimal('apy_percent', 5, 2).notNullable()
      table.integer('duration_days').notNullable()
      table.decimal('rewards_earned', 18, 8).defaultTo(0)
      table.timestamp('started_at').notNullable()
      table.timestamp('ends_at').notNullable()
      table.timestamp('last_reward_at').nullable()
      table.string('status').defaultTo('active') // active | completed | cancelled
      table.timestamps(true, true)
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
