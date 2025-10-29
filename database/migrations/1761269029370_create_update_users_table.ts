import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'users'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('referral_code').nullable().unique()
      table
        .uuid('referrer_id') // Changed to UUID
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')
        .nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('referral_code')
      table.dropColumn('referrer_id')
    })
  }
}
