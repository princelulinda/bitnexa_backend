import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'deposits'

  public async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.decimal('last_detected_balance', 20, 8).defaultTo(0).notNullable()
    })
  }

  public async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('last_detected_balance')
    })
  }
}
