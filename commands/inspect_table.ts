import { BaseCommand } from '@adonisjs/core/ace'
import db from '@adonisjs/lucid/services/db'

export default class InspectTable extends BaseCommand {
  static commandName = 'debug:inspect-table'
  static description = 'Inspect users table schema'
  static options = { startApp: true }

  async run() {
    const showSchema = async (label: string) => {
      this.logger.info(`--- ${label} ---`)
      const result = await db.rawQuery(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'hd_index'
      `)
      console.table(result.rows)
    }

    await showSchema('Initial Schema')

    try {
      this.logger.info('Applying fixes...')
      await db.rawQuery("ALTER TABLE users ALTER COLUMN hd_index SET DEFAULT nextval('users_hd_index_seq')")
      await db.rawQuery("UPDATE users SET hd_index = nextval('users_hd_index_seq') WHERE hd_index IS NULL")
      await db.rawQuery("ALTER TABLE users ALTER COLUMN hd_index SET NOT NULL")
      this.logger.success('Fixes applied successfully')
    } catch (e) {
      this.logger.error(`Failed to apply fixes: ${e.message}`)
    }

    await showSchema('Final Schema')
  }
}
