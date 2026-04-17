import { BaseCommand } from '@adonisjs/core/ace'
import { DateTime } from 'luxon'
import StakingPosition from '#models/staking_position'
import Transaction from '#models/transaction'
import Wallet from '#models/wallet'

export default class DistributeStakingRewards extends BaseCommand {
  static commandName = 'staking:distribute_rewards'
  static description = 'Distributes daily staking rewards to all active positions.'
  static options = { startApp: true }

  async run() {
    const now = DateTime.now().setZone('UTC')
    this.logger.info(`Distributing staking rewards — ${now.toISO()}`)

    const positions = await StakingPosition.query().where('status', 'active')

    let processed = 0

    for (const position of positions) {
      // Complete expired positions
      if (now >= position.endsAt) {
        const wallet = await Wallet.query().where('userId', position.userId).firstOrFail()
        const total = Number(position.amount) + Number(position.rewardsEarned)

        wallet.balance = Number(wallet.balance) + total
        await wallet.save()

        position.status = 'completed'
        await position.save()

        await Transaction.create({
          walletId: wallet.id,
          amount: total,
          type: 'staking_withdrawal',
          description: `Staking position completed. ${position.token} — Principal: $${position.amount} + Rewards: $${position.rewardsEarned}`,
          status: 'completed',
        })

        this.logger.info(`Position ${position.id} completed. Returned $${total} to user ${position.userId}`)
        processed++
        continue
      }

      // Skip if already rewarded today
      if (position.lastRewardAt && position.lastRewardAt.hasSame(now, 'day')) {
        continue
      }

      // daily_reward = amount × (apy / 100 / 365)
      const dailyReward = Number(position.amount) * (Number(position.apyPercent) / 100 / 365)
      const rounded = Math.round(dailyReward * 1e8) / 1e8

      if (rounded <= 0) continue

      const wallet = await Wallet.query().where('userId', position.userId).firstOrFail()

      position.rewardsEarned = Number(position.rewardsEarned) + rounded
      position.lastRewardAt = now
      await position.save()

      await Transaction.create({
        walletId: wallet.id,
        amount: rounded,
        type: 'staking_reward',
        description: `Daily staking reward — ${position.token} (${position.apyPercent}% APY)`,
        status: 'completed',
      })

      processed++
      this.logger.info(`Rewarded $${rounded} to user ${position.userId} for ${position.token} position`)
    }

    this.logger.info(`Done. ${processed} positions processed.`)
  }
}
