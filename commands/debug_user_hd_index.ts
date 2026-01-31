import { BaseCommand } from '@adonisjs/core/ace'
import { CommandOptions } from '@adonisjs/core/types/ace'
import db from '@adonisjs/lucid/services/db'

export default class DebugUserHdIndex extends BaseCommand {
  static commandName = 'debug:user-hd-index'
  static description = 'Debug User HD Index'
  static options: CommandOptions = {
    startApp: true
  }

  async run() {
    // Check count of nulls
    const result = await db.rawQuery('SELECT count(*) as count FROM users WHERE hd_index IS NULL')
    console.log('Users with NULL hd_index:', result.rows[0].count)

    if (result.rows[0].count > 0) {
        const nullUsers = await db.rawQuery('SELECT id, email FROM users WHERE hd_index IS NULL')
        console.log('Users with null hd_index:', nullUsers.rows)
    } else {
        console.log('All users have hd_index set.')
    }

    // Check if there are any users where the model property might be undefined despite DB having it? 
    // (Unlikely unless column mapping is wrong, which we verified is correct)
  }
}