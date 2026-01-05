import { BaseCommand } from '@adonisjs/core/ace'
import db from '@adonisjs/lucid/services/db'

export default class InspectTable extends BaseCommand {
  static commandName = 'debug:inspect-table'
  static description = 'Inspect users table schema'
  static options = { startApp: true }

  async run() {
    const result = await db.rawQuery(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'users'
    `)
    console.table(result.rows)
  }
}
