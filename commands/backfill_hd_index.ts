import { BaseCommand } from '@adonisjs/core/ace'
import User from '#models/user'
import db from '@adonisjs/lucid/services/db'

export default class BackfillHdIndex extends BaseCommand {
  static commandName = 'users:backfill-hd-index'
  static description = 'Assigns a unique HD Index to users who do not have one yet'
  
  static options = {
    startApp: true
  }

  async run() {
    this.logger.info('Starting HD Index backfill...')

    // 1. Ensure Sequence Exists
    try {
        await db.rawQuery('CREATE SEQUENCE IF NOT EXISTS users_hd_index_seq')
        this.logger.success('Sequence users_hd_index_seq verified/created.')
    } catch (e) {
        this.logger.error(`Error ensuring sequence: ${e.message}`)
        return
    }

    // 2. Fetch users
    const usersWithoutIndex = await User.query().whereNull('hd_index')
    this.logger.info(`Found ${usersWithoutIndex.length} users without HD Index.`)

    for (const user of usersWithoutIndex) {
      try {
        const result = await db.rawQuery("SELECT nextval('users_hd_index_seq') as index")
        const nextIndex = Number(result.rows[0].index)

        user.hdIndex = nextIndex
        await user.save()
        
        this.logger.success(`Assigned Index ${nextIndex} to user ${user.email}`)
      } catch (error) {
        this.logger.error(`Failed to assign index to user ${user.email}: ${error.message}`)
      }
    }

    this.logger.info('Backfill complete.')
  }
}