import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'signals'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('code', 6).nullable().after('description')
      table.dateTime('expires_at').nullable().after('code')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('code')
      table.dropColumn('expires_at')
    })
  }
}
