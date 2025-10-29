import { BaseCommand } from '@adonisjs/core/ace'
import Subscription from '#models/subscription'
import Wallet from '#models/wallet'
import Transaction from '#models/transaction'
import Plan from '#models/plan' // Import Plan model
import { DateTime } from 'luxon'

export default class CalculateDailyGains extends BaseCommand {
  static commandName = 'calculate:daily_gains'
  static description = 'Checks for auto-upgrades for active subscriptions.'

  async run() {
    this.logger.info('Checking for auto-upgrades...')

    const activeSubscriptions = await Subscription.query()
      .where('status', 'active')
      .preload('plan')
      .preload('wallet')

    if (activeSubscriptions.length === 0) {
      this.logger.info('No active subscriptions found.')
      return
    }

    // Fetch all active plans, ordered by minAmount for easy upgrade checking
    const allActivePlans = await Plan.query().where('isActive', true).orderBy('minAmount', 'asc')

    for (const subscription of activeSubscriptions) {
      const wallet = subscription.wallet
      const currentPlan = subscription.plan

      // --- 1. Check for Auto-Upgrade ---
      // Find the next eligible plan based on the user's total invested amount (investmentBalance)
      let nextEligiblePlan: Plan | null = null
      for (const plan of allActivePlans) {
        // Ensure the plan is superior and the user's investment balance meets its minimum
        if (plan.minAmount > currentPlan.minAmount && wallet.investmentBalance >= plan.minAmount) {
          nextEligiblePlan = plan
          // Since plans are ordered by minAmount, the first one found is the "next" upgrade
          break
        }
      }

      if (nextEligiblePlan) {
        // Perform the upgrade
        subscription.planId = nextEligiblePlan.id
        // The investedAmount in subscription should reflect the current investmentBalance
        subscription.investedAmount = wallet.investmentBalance
        subscription.startDate = DateTime.now() // Reset start date for new plan duration
        subscription.endDate = DateTime.now().plus({ days: nextEligiblePlan.durationDays })
        await subscription.save()

        await Transaction.create({
          walletId: wallet.id,
          amount: 0, // No direct fund movement
          type: 'plan_auto_upgrade',
          description: `Auto-upgraded from ${currentPlan.name} to ${nextEligiblePlan.name}`,
          relatedSubscriptionId: subscription.id,
          status: 'completed',
        })
        this.logger.info(
          `User ${wallet.userId} auto-upgraded from ${currentPlan.name} to ${nextEligiblePlan.name}.`
        )
      }
    }

    this.logger.info('Auto-upgrade check complete.')
  }
}
