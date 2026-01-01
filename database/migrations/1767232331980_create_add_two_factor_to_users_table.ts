import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'users'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('two_factor_secret').nullable()
      table.boolean('is_two_factor_enabled').defaultTo(false)
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('two_factor_secret')
      table.dropColumn('is_two_factor_enabled')
    })
  }
}
