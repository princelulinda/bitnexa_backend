import { HttpContext } from '@adonisjs/core/http'
import Plan from '#models/plan'
import Subscription from '#models/subscription'
import Transaction from '#models/transaction'
import { DateTime } from 'luxon' // Import DateTime
import { subscriptionValidator, upgradePlanValidator } from '#validators/subscription'
import BonusService from '#services/BonusService'

export default class SubscriptionsController {
  /**
   * Create a new subscription for a user
   */
  async create({ request, auth, response }: HttpContext) {
    const user = auth.user!
    const { planId, amount } = await request.validateUsing(subscriptionValidator)

    // Check if user already has an active subscription
    const existingSubscription = await user
      .related('subscriptions')
      .query()
      .where('status', 'active')
      .first()
    if (existingSubscription) {
      return response.badRequest('You already have an active subscription. Please upgrade instead.')
    }

    const plan = await Plan.findOrFail(planId)
    const wallet = await user.related('wallet').query().firstOrFail()

    // 1. Check if the plan is active
    if (!plan.isActive) {
      return response.badRequest('This plan is not active.')
    }

    // 2. Check if the investment amount is within the plan's limits
    if (amount < plan.minAmount || amount > plan.maxAmount) {
      return response.badRequest(
        `Investment amount must be between ${plan.minAmount} and ${plan.maxAmount}`
      )
    }

    // 3. Check if the user has enough balance in the current account
    if (wallet.balance < amount) {
      return response.badRequest('Insufficient funds in your current account.')
    }

    // 4. Move funds from current balance to investment balance
    console.log(
      'Before fund move: Balance =',
      wallet.balance,
      ', Investment Balance =',
      wallet.investmentBalance,
      ', Amount =',
      amount
    )
    wallet.balance = Number(wallet.balance) - Number(amount)
    wallet.investmentBalance = Number(wallet.investmentBalance) + Number(amount)
    await wallet.save()
    console.log(
      'After fund move and save: Balance =',
      wallet.balance,
      ', Investment Balance =',
      wallet.investmentBalance
    )

    // Transfer welcome bonus to investment balance
    const bonusService = new BonusService()
    await bonusService.transferWelcomeBonusToInvestment(wallet)

    // 5. Create the subscription record
    const subscription = await Subscription.create({
      userId: user.id,
      planId: plan.id,
      walletId: wallet.id,
      investedAmount: amount,
      status: 'active', // or 'pending' if it needs approval
      startDate: DateTime.now(),
      endDate: DateTime.now().plus({ days: plan.durationDays }),
    })

    // 6. Create a transaction log for the investment
    await Transaction.create({
      walletId: wallet.id,
      amount: -amount, // Negative amount for the current account
      type: 'investment',
      description: `Invested in ${plan.name} plan`,
      relatedSubscriptionId: subscription.id,
      status: 'completed',
    })

    return response.created({
      message: `Successfully subscribed to ${plan.name} plan.`,
      subscription,
    })
  }

  /**
   * Upgrade user's subscription plan
   */
  async upgrade({ request, auth, response }: HttpContext) {
    const user = auth.user!
    const { targetPlanId } = await request.validateUsing(upgradePlanValidator)

    const currentSubscription = await user
      .related('subscriptions')
      .query()
      .where('status', 'active')
      .first()
    if (!currentSubscription) {
      return response.badRequest('No active subscription found.')
    }

    const currentPlan = await Plan.findOrFail(currentSubscription.planId)
    const targetPlan = await Plan.findOrFail(targetPlanId)
    const wallet = await user.related('wallet').query().firstOrFail()

    // 1. Check if target plan is active and superior to current plan
    if (!targetPlan.isActive || targetPlan.minAmount <= currentPlan.minAmount) {
      return response.badRequest('Invalid target plan for upgrade.')
    }

    // 2. Check if user's investment balance meets the target plan's minimum amount
    if (wallet.investmentBalance < targetPlan.minAmount) {
      return response.badRequest(
        `Insufficient investment balance to upgrade to ${targetPlan.name}. Minimum required: ${targetPlan.minAmount}.`
      )
    }

    // 3. Update the subscription
    currentSubscription.planId = targetPlan.id
    currentSubscription.investedAmount = wallet.investmentBalance // The invested amount is now the total investment balance
    currentSubscription.startDate = DateTime.now() // Reset start date for new plan duration
    currentSubscription.endDate = DateTime.now().plus({ days: targetPlan.durationDays })
    await currentSubscription.save()

    // 4. Create a transaction log for the upgrade
    await Transaction.create({
      walletId: wallet.id,
      amount: 0, // No direct fund movement, just a plan change
      type: 'plan_upgrade',
      description: `Upgraded from ${currentPlan.name} to ${targetPlan.name}`,
      relatedSubscriptionId: currentSubscription.id,
      status: 'completed',
    })

    return response.ok({
      message: `Successfully upgraded to ${targetPlan.name} plan.`,
      subscription: currentSubscription,
    })
  }
}
