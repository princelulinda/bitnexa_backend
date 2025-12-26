import { BaseCommand } from '@adonisjs/core/ace'
import { DateTime } from 'luxon'
import Signal from '#models/signal'
import Plan from '#models/plan'
import { cuid } from '@adonisjs/core/helpers' // For generating unique codes

export default class GenerateDailySignals extends BaseCommand {
  static commandName = 'generate:daily_signals'
  static description = 'Generates 4 daily signal codes for active plans.'
  static options = {
    startApp: true,
  }

  async run() {
    this.logger.info('Generating daily signals...')

    const activePlans = await Plan.query().where('isActive', true)

    if (activePlans.length === 0) {
      this.logger.info('No active plans found to generate signals for.')
      return
    }

    for (const plan of activePlans) {
      // Generate 4 codes per active plan, as per requirement
      for (let i = 0; i < 4; i++) {
        const code = cuid().substring(0, 6).toUpperCase() // 6-character alphanumeric code
        const expiresAt = DateTime.now().plus({ minutes: 30 }) // Expires in 30 minutes

        await Signal.create({
          planId: plan.id,
          status: 'active', // Or 'pending', depending on desired flow
          description: `Daily signal for ${plan.name} plan`,
          code: code,
          expiresAt: expiresAt,
        })
        this.logger.info(
          `Generated signal for Plan ${plan.name}: ${code} (Expires: ${expiresAt.toFormat('HH:mm')})`
        )
      }
    }

    this.logger.info('Daily signals generation complete.')
  }
}
