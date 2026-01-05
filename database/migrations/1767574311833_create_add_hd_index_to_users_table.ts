import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'users'

  public async up() {
    // 1. Create Sequence
    await this.db.raw('CREATE SEQUENCE IF NOT EXISTS users_hd_index_seq')

    // 2. Add column as nullable first
    this.schema.alterTable(this.tableName, (table) => {
      table.integer('hd_index').nullable()
    })

    // 3. Populate existing users with unique values
    // "defer" is not needed if we await db.raw directly in up(), but schema operations are queued.
    // To be safe with mixing schema builder and raw queries, we should use defer for the raw parts 
    // OR just ensure they run after the table alter.
    // However, schema.alterTable schedules the query. calling await db.raw executes immediately?
    // Actually, migration up() is async. schema.alterTable adds to a queue? No, Knex executes immediately if awaited? 
    // Adonis schema wrapper queues them?
    
    // Let's use defer for everything to ensure order? No.
    // The standard way in Adonis migrations is to rely on the fact that `this.schema.*` calls are checking the state?
    // Actually, `this.schema` returns a SchemaBuilder which is a Promise-like. I need to NOT await it?
    // No, I verify existing migrations.
    
    // Existing:
    // this.schema.createTable(...)
    
    // If I use `this.defer` for raw queries, they run in the correct order relative to schema operations.
    
    this.defer(async (db) => {
      await db.raw("UPDATE users SET hd_index = nextval('users_hd_index_seq')")
      await db.raw("ALTER TABLE users ALTER COLUMN hd_index SET DEFAULT nextval('users_hd_index_seq')")
      await db.raw("ALTER TABLE users ALTER COLUMN hd_index SET NOT NULL")
      await db.raw("CREATE UNIQUE INDEX users_hd_index_unique ON users (hd_index)")
    })
  }

  public async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('hd_index')
    })
    
    this.defer(async (db) => {
        await db.raw('DROP SEQUENCE IF EXISTS users_hd_index_seq')
    })
  }
}