import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'wallets'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      // Amount credited by admin — visible in balance but cannot be withdrawn until level reached
      table.decimal('locked_capital', 18, 2).defaultTo(0).notNullable()
      table.integer('withdrawal_unlock_level').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('locked_capital')
      table.dropColumn('withdrawal_unlock_level')
    })
  }
}
