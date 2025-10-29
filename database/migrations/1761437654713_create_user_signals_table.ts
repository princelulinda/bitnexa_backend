import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'user_signals'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      // ID principal en UUID
      table.uuid('id').primary()

      // Référence vers users (UUID)
      table
        .uuid('user_id')
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')
        .onUpdate('CASCADE')

      // Référence vers signals (integer si signals.id est integer)
      table
        .integer('signal_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('signals')
        .onDelete('CASCADE')
        .onUpdate('CASCADE')

      table.dateTime('used_at').notNullable()

      table.timestamp('created_at', { useTz: true }).defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).defaultTo(this.now())

      // Empêche un utilisateur d’utiliser deux fois le même signal
      table.unique(['user_id', 'signal_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
