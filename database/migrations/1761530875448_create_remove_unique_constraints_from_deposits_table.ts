import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'deposits'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      // Drop the unique constraint on the 'address' column using its original name
      table.dropUnique(['address'], 'deposit_addresses_address_unique')

      // Drop the unique constraint on ['user_id', 'currency', 'network'] using its original name
      table.dropUnique(
        ['user_id', 'currency', 'network'],
        'deposit_addresses_user_id_currency_network_unique'
      )
    })
  }

  async down() {
    // this.schema.alterTable(this.tableName, (table) => {
    //   // Re-add the unique constraint on the 'address' column
    //   table.string('address').unique().alter()
    //
    //   // Re-add the unique constraint on ['user_id', 'currency', 'network']
    //   table.unique(['user_id', 'currency', 'network'])
    // })
  }
}
