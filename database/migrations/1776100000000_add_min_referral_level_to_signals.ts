import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'signals'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.integer('min_referral_level').defaultTo(0).after('is_exclusive')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('min_referral_level')
    })
  }
}
