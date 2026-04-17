import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import vine from '@vinejs/vine'
import StakingPlan from '#models/staking_plan'
import StakingPosition from '#models/staking_position'
import Transaction from '#models/transaction'

const stakeValidator = vine.compile(
  vine.object({
    stakingPlanId: vine.string().uuid(),
    amount: vine.number().positive(),
  })
)

export default class StakingController {
  /** GET /staking/plans — list active plans */
  async plans({ response }: HttpContext) {
    const plans = await StakingPlan.query().where('isActive', true).orderBy('token').orderBy('durationDays')
    return response.ok(plans)
  }

  /** GET /staking/positions — user active/past positions */
  async positions({ auth, response }: HttpContext) {
    const user = auth.user!
    const positions = await StakingPosition.query()
      .where('userId', user.id)
      .preload('stakingPlan')
      .orderBy('createdAt', 'desc')
    return response.ok(positions)
  }

  /** POST /staking/stake — create a staking position */
  async stake({ request, auth, response }: HttpContext) {
    const user = auth.user!
    const { stakingPlanId, amount } = await request.validateUsing(stakeValidator)

    const plan = await StakingPlan.find(stakingPlanId)
    if (!plan || !plan.isActive) {
      return response.notFound('Staking plan not found or inactive.')
    }

    if (amount < plan.minAmount) {
      return response.badRequest(`Minimum staking amount is $${plan.minAmount}.`)
    }

    const wallet = await user.related('wallet').query().firstOrFail()
    if (Number(wallet.balance) < amount) {
      return response.badRequest('Insufficient balance.')
    }

    // Deduct from balance
    wallet.balance = Number(wallet.balance) - amount
    await wallet.save()

    const now = DateTime.now().setZone('UTC')
    const position = await StakingPosition.create({
      userId: user.id,
      stakingPlanId: plan.id,
      token: plan.token,
      amount,
      apyPercent: plan.apyPercent,
      durationDays: plan.durationDays,
      rewardsEarned: 0,
      startedAt: now,
      endsAt: now.plus({ days: plan.durationDays }),
      lastRewardAt: null,
      status: 'active',
    })

    await Transaction.create({
      walletId: wallet.id,
      amount,
      type: 'staking_deposit',
      description: `Staked $${amount} in ${plan.token} (${plan.durationDays} days @ ${plan.apyPercent}% APY)`,
      status: 'completed',
    })

    return response.created({
      message: `Successfully staked $${amount} in ${plan.token}.`,
      position,
    })
  }

  /** POST /staking/unstake/:id — early unstake with 10% penalty */
  async unstake({ auth, params, response }: HttpContext) {
    const user = auth.user!

    const position = await StakingPosition.query()
      .where('id', params.id)
      .where('userId', user.id)
      .where('status', 'active')
      .first()

    if (!position) {
      return response.notFound('Active staking position not found.')
    }

    const now = DateTime.now().setZone('UTC')
    const isExpired = now >= position.endsAt
    const wallet = await user.related('wallet').query().firstOrFail()

    let returnAmount = Number(position.amount) + Number(position.rewardsEarned)
    let penalty = 0

    if (!isExpired) {
      // 10% early unstake penalty on principal only
      penalty = Math.round(Number(position.amount) * 0.1 * 100) / 100
      returnAmount = returnAmount - penalty
    }

    wallet.balance = Number(wallet.balance) + returnAmount
    await wallet.save()

    position.status = isExpired ? 'completed' : 'cancelled'
    await position.save()

    await Transaction.create({
      walletId: wallet.id,
      amount: returnAmount,
      type: 'staking_withdrawal',
      description: `Unstaked ${position.token} position. Principal: $${position.amount}, Rewards: $${position.rewardsEarned}${penalty > 0 ? `, Penalty: -$${penalty}` : ''}`,
      status: 'completed',
    })

    return response.ok({
      message: isExpired ? 'Position completed and funds returned.' : `Early unstake applied. Penalty: $${penalty}`,
      returnAmount,
      penalty,
    })
  }
}
