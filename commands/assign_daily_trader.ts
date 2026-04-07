import { BaseCommand } from '@adonisjs/core/ace'
import { DateTime } from 'luxon'
import Trader from '#models/trader'
import DailyTrader from '#models/daily_trader'

export default class AssignDailyTrader extends BaseCommand {
  static commandName = 'assign:daily_trader'
  static description = 'Assigns a random active trader as the trader of the day.'
  static options = {
    startApp: true,
  }

  async run() {
    const today = DateTime.now().setZone('UTC').toISODate()!

    // Check if already assigned today
    const existing = await DailyTrader.query().where('date', today).first()
    if (existing) {
      this.logger.info(`Daily trader already assigned for ${today}.`)
      return
    }

    // Pick a random active trader
    const traders = await Trader.query().where('isActive', true)
    if (traders.length === 0) {
      this.logger.error('No active traders found.')
      return
    }

    const randomTrader = traders[Math.floor(Math.random() * traders.length)]

    await DailyTrader.create({
      traderId: randomTrader.id,
      date: DateTime.now().setZone('UTC').startOf('day'),
    })

    this.logger.info(`Daily trader assigned: ${randomTrader.name} for ${today}`)
  }
}
