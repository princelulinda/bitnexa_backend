import { HttpContext } from '@adonisjs/core/http'
import ace from '@adonisjs/core/services/ace'
import Signal from '#models/signal'
import Plan from '#models/plan'
import User from '#models/user'
import Subscription from '#models/subscription'
import Trader from '#models/trader'
import DailyTrader from '#models/daily_trader'
import { cuid } from '@adonisjs/core/helpers'
import { DateTime } from 'luxon'
import mail from '@adonisjs/mail/services/main'

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

  /**
   * Génère un signal spécial pour les nouveaux investisseurs (souscription de moins de 4 jours)
   */
  async generateNewInvestorsSignal({ response }: HttpContext) {
    try {
      const threeDaysAgo = DateTime.now().minus({ days: 3 }).toSQL()

      // 1. Trouver les nouvelles souscriptions actives (moins de 4 jours)
      const recentSubscriptions = await Subscription.query()
        .where('status', 'active')
        .where('startDate', '>=', threeDaysAgo!)
        .preload('user')
        .preload('plan')

      if (recentSubscriptions.length === 0) {
        return response.ok({ message: 'Aucune nouvelle souscription trouvée ces 3 derniers jours.' })
      }

      const generatedSignals: any[] = []
      const processedPlanIds = new Set<string>()

      for (const sub of recentSubscriptions) {
        const user = sub.user
        const plan = sub.plan

        // Éviter de générer plusieurs fois le même signal pour un même plan
        if (!processedPlanIds.has(plan.id)) {
          const code = cuid().substring(0, 6).toUpperCase()
          const expiresAt = DateTime.now().plus({ hours: 1 }) // Valide 1 heure pour les nouveaux

                      const signal = await Signal.create({
                        planId: plan.id,
                        status: 'active',
                        isExclusive: true,
                        description: `Signal spécial nouvelle souscription (${plan.name})`,
                        code: code,
                        expiresAt: expiresAt,
                      })
                    generatedSignals.push({ planName: plan.name, code, signalId: signal.id })
          processedPlanIds.add(plan.id)
        }

        // Trouver les infos du signal pour ce plan
        const signalInfo = generatedSignals.find((s) => s.planName === plan.name)

        // Envoyer l'email à l'abonné récent
        await mail.send((message) => {
          message
            .to(user.email)
            .subject('🎁 Signal Spécial Nouvel Investisseur - Trsbit')
            .htmlView('emails/new_signal', {
              user,
              code: signalInfo.code,
              expiresAt: DateTime.now().plus({ hours: 1 }).toFormat('HH:mm'),
              year: DateTime.now().year,
            })
        })
      }

      return response.ok({
        message: `Signaux générés et envoyés à ${recentSubscriptions.length} nouveaux investisseurs.`,
        details: generatedSignals,
      })
    } catch (error) {
      console.error('Erreur lors de la génération du signal nouveaux investisseurs:', error)
      return response.internalServerError({
        message: 'Échec de la génération du signal pour les nouveaux investisseurs.',
      })
    }
  }

  /**
   * Get today's daily trader, auto-generate if not yet assigned.
   * GET /admin/api/daily-trader
   */
  async getDailyTrader({ response }: HttpContext) {
    const today = DateTime.now().setZone('UTC').toISODate()!

    let dailyTrader = await DailyTrader.query()
      .where('date', today)
      .preload('trader')
      .first()

    let generated = false

    if (!dailyTrader) {
      // Pick a random active trader
      const traders = await Trader.query().where('isActive', true)
      if (!traders.length) {
        return response.notFound({ message: 'No active traders available to assign.' })
      }
      const picked = traders[Math.floor(Math.random() * traders.length)]
      dailyTrader = await DailyTrader.create({
        traderId: picked.id,
        date: DateTime.fromISO(today),
      })
      await dailyTrader.load('trader')
      generated = true
    }

    return response.ok({
      generated,
      date: today,
      trader: dailyTrader.trader,
    })
  }
}
