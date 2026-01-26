import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'users'

  public async up() {
    // 1. Ensure sequence exists
    await this.db.raw('CREATE SEQUENCE IF NOT EXISTS users_hd_index_seq')

    // 2. Assign unique index to any user that might have NULL (safety)
    await this.db.raw("UPDATE users SET hd_index = nextval('users_hd_index_seq') WHERE hd_index IS NULL")

    // 3. Set default value and NOT NULL constraint
    // We use raw queries here because SchemaBuilder's alterTable can be finicky with sequences in some PG versions
    await this.db.raw("ALTER TABLE users ALTER COLUMN hd_index SET DEFAULT nextval('users_hd_index_seq')")
    await this.db.raw("ALTER TABLE users ALTER COLUMN hd_index SET NOT NULL")
    
    // 4. Ensure unique index exists
    await this.db.raw('DROP INDEX IF EXISTS users_hd_index_unique')
    await this.db.raw('CREATE UNIQUE INDEX users_hd_index_unique ON users (hd_index)')
  }

  public async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.integer('hd_index').nullable().alter()
      table.dropColumn('hd_index') // or just remove default? Better to just make it nullable
    })
    
    await this.db.raw('ALTER TABLE users ALTER COLUMN hd_index DROP DEFAULT')
  }
}
