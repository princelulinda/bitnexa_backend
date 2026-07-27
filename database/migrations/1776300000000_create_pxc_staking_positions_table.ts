import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'pxc_staking_positions'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.db.rawQuery('gen_random_uuid()').knexQuery)
      table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE')

      // Montant de tokens PXC stakés (depuis airdropBalance)
      table.decimal('amount', 18, 6).notNullable()

      // Récompenses accumulées en tokens PXC (5% par jour)
      table.decimal('rewards_earned', 18, 6).notNullable().defaultTo(0)

      // Taux journalier en % (5.00 = 5%/jour)
      table.decimal('daily_rate_percent', 5, 2).notNullable().defaultTo(5.00)

      // Statut : active | completed | cancelled
      table.string('status', 20).notNullable().defaultTo('active')

      // Date du dernier calcul de récompense
      table.timestamp('last_reward_at', { useTz: true }).nullable()

      // Date de départ du staking
      table.timestamp('started_at', { useTz: true }).notNullable()

      // Date de fin (null = staking illimité, on peut unstake à tout moment)
      table.timestamp('ended_at', { useTz: true }).nullable()

      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()
    })

    this.schema.raw('CREATE INDEX idx_pxc_staking_user ON pxc_staking_positions(user_id)')
    this.schema.raw('CREATE INDEX idx_pxc_staking_status ON pxc_staking_positions(status)')
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
