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
    // Raw query to check what is in the DB
    const result = await db.rawQuery('SELECT id, email, hd_index FROM users LIMIT 1')
    console.log('Raw DB Result:', result.rows[0])

    const User = (await import('#models/user')).default
    const user = await User.first()
    if (user) {
        console.log(`Model User found: ${user.email}`)
        console.log(`Model HD Index: ${user.hdIndex}`)
        // Check if it's in $extras or $original
        console.log('User $original:', user.$original)
    } else {
        console.log('No user found')
    }
  }
}