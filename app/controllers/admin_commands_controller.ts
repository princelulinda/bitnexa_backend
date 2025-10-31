import { HttpContext } from '@adonisjs/core/http'
import ace from '@adonisjs/core/services/ace'
import Signal from '#models/signal'
import Plan from '#models/plan'
import { cuid } from '@adonisjs/core/helpers'
import { DateTime } from 'luxon'

export default class AdminCommandsController {
  async calculateReferralLevels({ response }: HttpContext) {
    try {
      await ace.exec('calculate:referral-levels', [])
      return response.ok({ message: 'Referral levels calculation triggered successfully.' })
    } catch (error) {
      console.error('Error triggering referral levels calculation:', error)
      return response.internalServerError({
        message: 'Failed to trigger referral levels calculation.',
      })
    }
  }

  async generateSingleSignal({ params, response }: HttpContext) {
    try {
      const plan = await Plan.findOrFail(params.planId)

      const code = cuid().substring(0, 6).toUpperCase()
      const expiresAt = DateTime.now().plus({ minutes: 30 })

      const signal = await Signal.create({
        planId: plan.id,
        status: 'active',
        description: `Manual signal for ${plan.name}`,
        code: code,
        expiresAt: expiresAt,
      })

      return response.ok({
        message: `Signal ${code} generated successfully for plan ${plan.name}`,
        signal,
      })
    } catch (error) {
      console.error('Error generating single signal:', error)
      return response.internalServerError({ message: 'Failed to generate signal.' })
    }
  }
}
