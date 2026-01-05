import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'users'

  public async up() {
    // 1. Ensure sequence exists (it should, but just in case)
    await this.db.raw('CREATE SEQUENCE IF NOT EXISTS users_hd_index_seq')

    // 2. Update users who have null hd_index
    // We select them and update one by one or in bulk, but SQL update with nextval is easiest.
    await this.db.raw("UPDATE users SET hd_index = nextval('users_hd_index_seq') WHERE hd_index IS NULL")

    // 3. Enforce NOT NULL constraint again (forcefully)
    // We use defer to ensure it runs? No, let's just await it.
    await this.db.raw("ALTER TABLE users ALTER COLUMN hd_index SET NOT NULL")
  }

  public async down() {
    // Can't really undo the data update easily without losing info, but we can make it nullable again.
    this.schema.alterTable(this.tableName, (table) => {
      table.integer('hd_index').nullable().alter()
    })
  }
}
