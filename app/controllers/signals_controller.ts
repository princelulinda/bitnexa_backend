import { HttpContext } from '@adonisjs/core/http'
import Signal from '#models/signal'
import UserSignal from '#models/user_signal'
import Transaction from '#models/transaction'
import { DateTime } from 'luxon'
import { useSignalValidator } from '#validators/signal' // We will create this validator

export default class SignalsController {
  /**
   * Use a daily signal code to claim benefits
   */
  async useSignal({ request, auth, response, logger }: HttpContext) {
    const user = auth.user!
    const { code } = await request.validateUsing(useSignalValidator)

    // 1. Find the signal by code
    const signal = await Signal.query().where('code', code).preload('plan').first()

    if (!signal) {
      return response.notFound('Signal not found.')
    }

    // 2. Check if signal is expired
    if (signal.expiresAt && signal.expiresAt < DateTime.now()) {
      return response.badRequest('Signal has expired.')
    }

    // 3. Check if user has an active subscription to the signal's plan
    const userSubscription = await user
      .related('subscriptions')
      .query()
      .where('planId', signal.planId)
      .where('status', 'active')
      .first()

    if (!userSubscription) {
      return response.forbidden(
        "You must have an active subscription to this signal's plan to use it."
      )
    }

    // 3b. Check exclusivity for new investors
    if (signal.isExclusive) {
      const fourDaysAgo = DateTime.now().minus({ days: 4 })
      if (userSubscription.startDate < fourDaysAgo) {
        return response.forbidden(
          'This exclusive signal is only available for subscribers of less than 4 days.'
        )
      }
    }

    // 4. Check if user has already used this specific signal
    const userSignal = await UserSignal.query()
      .where('userId', user.id)
      .where('signalId', signal.id)
      .first()

    if (userSignal) {
      return response.badRequest('You have already used this signal.')
    }

    // 5. Record that the user has used this signal
    await UserSignal.create({
      userId: user.id,
      signalId: signal.id,
      usedAt: DateTime.now(),
    })

    // 6. Perform gain calculation (Option B: daily gain split across 4 signals)
    const wallet = await user.related('wallet').query().firstOrFail()
    const plan = signal.plan // Preloaded plan

    // Explicitly cast to Number to ensure arithmetic operations
    const currentInvestmentBalance = Number(wallet.investmentBalance)
    const currentGainsBalance = Number(wallet.gainsBalance)

    const baseAmountForGains = currentInvestmentBalance + currentGainsBalance
    const gainPerSignal = baseAmountForGains * (plan.gainMultiplier / 100 / 4) // Divide by 4 for 4 signals per day

    if (gainPerSignal > 0) {
      wallet.gainsBalance = currentGainsBalance + gainPerSignal // Update using the number value
      await wallet.save()

      await Transaction.create({
        walletId: wallet.id,
        amount: gainPerSignal,
        type: 'signal_gain',
        description: `Gain from signal ${signal.code} for plan ${plan.name}`,
        relatedSubscriptionId: userSubscription.id,
        status: 'completed',
      })
      logger.info(
        `User ${user.id} gained ${gainPerSignal.toFixed(2)} from signal ${signal.code}. New gainsBalance: ${Number(wallet.gainsBalance).toFixed(2)}`
      )
    }

    return response.ok({
      message: `Signal ${signal.code} used successfully. Your gains have been updated.`,
      gains: gainPerSignal.toFixed(2),
      newGainsBalance: Number(wallet.gainsBalance).toFixed(2),
    })
  }

  /**
   * Get the current active signal for the authenticated user
   */
  async getCurrentSignal({ auth, response }: HttpContext) {
    const user = auth.user!

    // 1. Get user's active subscriptions plan IDs
    const activeSubscriptions = await user
      .related('subscriptions')
      .query()
      .where('status', 'active')
      .select('planId')

    if (activeSubscriptions.length === 0) {
      return response.ok({
        signal: null,
        message: 'No active subscription found.',
      })
    }

    const planIds = activeSubscriptions.map((sub) => sub.planId)

    // 2. Find the latest active signal for these plans
    const signal = await Signal.query()
      .whereIn('planId', planIds)
      .where('expiresAt', '>', DateTime.now().toSQL())
      .orderBy('createdAt', 'desc')
      .preload('plan')
      .first()

    if (!signal) {
      return response.ok({
        signal: null,
        message: 'No active signal at the moment.',
      })
    }

    // 3. Check if user has already used this signal
    const hasUsed = await UserSignal.query()
      .where('userId', user.id)
      .where('signalId', signal.id)
      .first()

    return response.ok({
      signal: {
        code: signal.code,
        expiresAt: signal.expiresAt,
        planName: signal.plan.name,
        isUsed: !!hasUsed,
      },
    })
  }
}
