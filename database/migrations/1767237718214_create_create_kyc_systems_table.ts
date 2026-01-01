import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'kyc_submissions'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.db.rawQuery('gen_random_uuid()').knexQuery)
      table
        .uuid('user_id')
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')
      
      table.string('document_type').notNullable() // passport, id_card, drivers_license
      table.string('document_number').nullable()
      table.string('document_front_url').notNullable()
      table.string('document_back_url').nullable() // Nullable for passport
      table.string('selfie_url').notNullable()
      
      table.enum('status', ['pending', 'approved', 'rejected']).defaultTo('pending')
      table.text('rejection_reason').nullable()
      
      table.timestamp('submitted_at', { useTz: true }).defaultTo(this.now())
      table.timestamp('reviewed_at', { useTz: true }).nullable()
      
      table.timestamp('created_at')
      table.timestamp('updated_at')
    })

    this.schema.alterTable('users', (table) => {
      table
        .enum('kyc_status', ['unverified', 'pending', 'verified', 'rejected'])
        .defaultTo('unverified')
    })
  }

  async down() {
    this.schema.alterTable('users', (table) => {
      table.dropColumn('kyc_status')
    })
    this.schema.dropTable(this.tableName)
  }
}
