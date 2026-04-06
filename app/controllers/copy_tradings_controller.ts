import { HttpContext } from '@adonisjs/core/http'
import Trader from '#models/trader'
import UserCopyTrade from '#models/user_copy_trade'
import Transaction from '#models/transaction'
import { DateTime } from 'luxon'
import { copyTraderValidator } from '#validators/copy_trading'

export default class CopyTradingController {
  /**
   * Get list of active traders
   */
  async index({ response }: HttpContext) {
    const traders = await Trader.query().where('isActive', true)
    return response.ok(traders)
  }

  /**
   * Copy a trader to earn gains (similar to Signal)
   */
  async copyTrader({ request, auth, response, logger }: HttpContext) {
    const user = auth.user!
    const { traderId } = await request.validateUsing(copyTraderValidator)

    // 1. Find the trader
    const trader = await Trader.find(traderId)
    if (!trader || !trader.isActive) {
      return response.notFound('Trader not found or inactive.')
    }

    // 2. Check user's active subscription (we pick the first active one or base on plan)
    const userSubscription = await user
      .related('subscriptions')
      .query()
      .where('status', 'active')
      .preload('plan')
      .first()

    if (!userSubscription) {
      return response.forbidden('You must have an active subscription to use copy trading.')
    }

    // 3. Check daily limit (3 copies per day, same as signals)
    const today = DateTime.now().startOf('day')
    const copiesToday = await UserCopyTrade.query()
      .where('userId', user.id)
      .where('usedAt', '>=', today.toSQL())
      .count('* as total')
    
    if (Number(copiesToday[0].$extras.total) >= 3) {
      return response.badRequest('You have reached your daily copy trading limit (3 per day).')
    }

    // 4. Record the copy trade
    await UserCopyTrade.create({
      userId: user.id,
      traderId: trader.id,
      usedAt: DateTime.now(),
    })

    // 5. Calculate Gains (Same logic as SignalsController)
    const wallet = await user.related('wallet').query().firstOrFail()
    const plan = userSubscription.plan

    const currentInvestmentBalance = Number(wallet.investmentBalance)
    const baseAmountForGains = currentInvestmentBalance
    
    // Gain logic: Daily gain / 3 (since there are 3 actions per day)
    const gainPerCopy = baseAmountForGains * (plan.gainMultiplier / 100 / 3)

    if (gainPerCopy > 0) {
      // Auto-Reinvest
      wallet.investmentBalance = currentInvestmentBalance + gainPerCopy
      await wallet.save()

      await Transaction.create({
        walletId: wallet.id,
        amount: gainPerCopy,
        type: 'copy_trade_gain',
        description: `Gain from copying trader ${trader.name}.`,
        relatedSubscriptionId: userSubscription.id,
        status: 'completed',
      })

      logger.info(`User ${user.id} gained ${gainPerCopy.toFixed(2)} from copying ${trader.name}.`)
    }

    return response.ok({
      message: `Successfully copied trader ${trader.name}.`,
      gains: gainPerCopy.toFixed(2),
      newInvestmentBalance: Number(wallet.investmentBalance).toFixed(2),
    })
  }

  /**
   * Get history of copy trades
   */
  async getHistory({ auth, response }: HttpContext) {
    const user = auth.user!

    const history = await UserCopyTrade.query()
      .where('userId', user.id)
      .preload('trader')
      .orderBy('usedAt', 'desc')

    return response.ok({
      history: history.map((item) => ({
        id: item.id,
        traderName: item.trader?.name,
        traderAvatar: item.trader?.avatarUrl,
        usedAt: item.usedAt,
      })),
    })
  }
}
