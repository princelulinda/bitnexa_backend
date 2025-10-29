import { BaseSchema } from '@adonisjs/lucid/schema'

export default class AddInvestmentFieldsToWallets extends BaseSchema {
  protected tableName = 'wallets'

  async up() {
    const hasInvestment = await this.schema.hasColumn(this.tableName, 'investment_balance')
    const hasGains = await this.schema.hasColumn(this.tableName, 'gains_balance')

    this.schema.alterTable(this.tableName, (table) => {
      if (!hasInvestment) {
        table.decimal('investment_balance', 14, 2).notNullable().defaultTo(0).after('balance')
      }
      if (!hasGains) {
        table.decimal('gains_balance', 14, 2).notNullable().defaultTo(0).after('investment_balance')
      }
    })
  }

  async down() {
    const hasInvestment = await this.schema.hasColumn(this.tableName, 'investment_balance')
    const hasGains = await this.schema.hasColumn(this.tableName, 'gains_balance')

    this.schema.alterTable(this.tableName, (table) => {
      if (hasInvestment) {
        table.dropColumn('investment_balance')
      }
      if (hasGains) {
        table.dropColumn('gains_balance')
      }
    })
  }
}
