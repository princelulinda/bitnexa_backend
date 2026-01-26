import { BaseCommand } from '@adonisjs/core/ace'
import db from '@adonisjs/lucid/services/db'

export default class InspectSequences extends BaseCommand {
  static commandName = 'debug:inspect-sequences'
  static description = 'Inspect sequences'
  static options = { startApp: true }

  async run() {
    try {
      const result = await db.rawQuery(`
        SELECT sequence_schema, sequence_name FROM information_schema.sequences
      `)
      console.table(result.rows)

      const nextVal = await db.rawQuery("SELECT nextval('users_hd_index_seq') as index")
      console.log('Next value from sequence:', nextVal.rows[0].index)
    } catch (e) {
      console.error('Error during inspection:', e.message)
    }
  }
}
