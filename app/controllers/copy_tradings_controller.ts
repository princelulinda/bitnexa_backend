import { HttpContext } from '@adonisjs/core/http'
import Trader from '#models/trader'
import DailyTrader from '#models/daily_trader'
import UserCopyTrade from '#models/user_copy_trade'
import Transaction from '#models/transaction'
import { DateTime } from 'luxon'

// Two fixed copy windows per day (24h format)
const COPY_WINDOWS: { hour: number; minute: number }[] = [
  { hour: 11, minute: 0 }, 
  { hour: 14, minute: 0 }, 
]

// Each window stays open for 30 minutes
const WINDOW_DURATION_MINUTES = 30

export default class CopyTradingController {
  /**
   * Get list of active traders
   */
  async index({ response }: HttpContext) {
    const traders = await Trader.query().where('isActive', true)
    return response.ok(traders)
  }

  /**
   * Get today's assigned trader and copy windows info
   */
  async getDailyTrader({ auth, response }: HttpContext) {
    const user = auth.user!
    const today = DateTime.now().setZone('UTC').toISODate()!

    const dailyTrader = await DailyTrader.query()
      .where('date', today)
      .preload('trader')
      .first()

    if (!dailyTrader) {
      return response.ok({ trader: null, message: 'No trader assigned for today yet.' })
    }

    const copiesToday = await UserCopyTrade.query()
      .where('userId', user.id)
      .where('usedAt', '>=', DateTime.now().setZone('UTC').startOf('day').toSQL())
      .count('* as total')

    const usedCount = Number(copiesToday[0].$extras.total)

    return response.ok({
      trader: dailyTrader.trader,
      windows: COPY_WINDOWS.map((w, i) => ({
        slot: i + 1,
        opensAt: `${String(w.hour).padStart(2, '0')}:${String(w.minute).padStart(2, '0')}`,
        closesAt: `${String(w.hour).padStart(2, '0')}:${String(w.minute + WINDOW_DURATION_MINUTES).padStart(2, '0')}`,
      })),
      copiesUsedToday: usedCount,
      copiesRemaining: Math.max(0, COPY_WINDOWS.length - usedCount),
    })
  }

  /**
   * Copy the daily trader — only allowed during fixed time windows
   */
  async copyTrader({ auth, response, logger }: HttpContext) {
    const user = auth.user!
    const now = DateTime.now().setZone('UTC')
    const today = now.toISODate()!

    // 1. Get today's daily trader
    const dailyTrader = await DailyTrader.query()
      .where('date', today)
      .preload('trader')
      .first()

    if (!dailyTrader || !dailyTrader.trader?.isActive) {
      return response.notFound('No active trader assigned for today.')
    }

    const trader = dailyTrader.trader

    // 2. Find the current open window (if any)
    const currentWindow = COPY_WINDOWS.find((w) => {
      const windowStart = now.set({ hour: w.hour, minute: w.minute, second: 0, millisecond: 0 })
      const windowEnd = windowStart.plus({ minutes: WINDOW_DURATION_MINUTES })
      return now >= windowStart && now <= windowEnd
    })

    if (!currentWindow) {
      const nextWindow = COPY_WINDOWS.find((w) => {
        const windowStart = now.set({ hour: w.hour, minute: w.minute, second: 0, millisecond: 0 })
        return windowStart > now
      })
      const nextMsg = nextWindow
        ? `Next window opens at ${String(nextWindow.hour).padStart(2, '0')}:${String(nextWindow.minute).padStart(2, '0')}.`
        : 'No more copy windows today.'
      return response.badRequest(`Copy trading is not available right now. ${nextMsg}`)
    }

    // 3. Check active subscription
    const userSubscription = await user
      .related('subscriptions')
      .query()
      .where('status', 'active')
      .preload('plan')
      .first()

    if (!userSubscription) {
      return response.forbidden('You must have an active subscription to use copy trading.')
    }

    // 4. Check daily limit
    const copiesToday = await UserCopyTrade.query()
      .where('userId', user.id)
      .where('usedAt', '>=', now.startOf('day').toSQL())
      .count('* as total')

    if (Number(copiesToday[0].$extras.total) >= COPY_WINDOWS.length) {
      return response.badRequest(
        `You have already used all ${COPY_WINDOWS.length} copy trading slots for today.`
      )
    }

    // 5. Check user hasn't already copied during this specific window
    const windowStart = now.set({
      hour: currentWindow.hour,
      minute: currentWindow.minute,
      second: 0,
      millisecond: 0,
    })

    const alreadyCopiedThisWindow = await UserCopyTrade.query()
      .where('userId', user.id)
      .where('usedAt', '>=', windowStart.toSQL())
      .first()

    if (alreadyCopiedThisWindow) {
      return response.badRequest('You have already copied during this window.')
    }

    // 6. Record the copy trade
    await UserCopyTrade.create({
      userId: user.id,
      traderId: trader.id,
      usedAt: now,
    })

    // 7. Calculate gains (daily gain split across 2 windows)
    const wallet = await user.related('wallet').query().firstOrFail()
    const plan = userSubscription.plan
    const currentInvestmentBalance = Number(wallet.investmentBalance)
    const gainPerCopy = currentInvestmentBalance * (plan.gainMultiplier / 100 / COPY_WINDOWS.length)

    if (gainPerCopy > 0) {
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
