import { BaseCommand } from '@adonisjs/core/ace'
import db from '@adonisjs/lucid/services/db'

export default class InspectSequences extends BaseCommand {
  static commandName = 'debug:inspect-sequences'
  static description = 'Inspect sequences'
  static options = { startApp: true }

  async run() {
    const result = await db.rawQuery(`
      SELECT sequence_name FROM information_schema.sequences
    `)
    console.table(result.rows)
  }
}
