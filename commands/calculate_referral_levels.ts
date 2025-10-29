import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import User from '#models/user'
import ReferralLevel from '#models/referral_level'
import Transaction from '#models/transaction'
import { DateTime } from 'luxon'

export default class CalculateReferralLevels extends BaseCommand {
  static commandName = 'calculate:referral-levels'
  static description = 'Calculates referral levels for users and distributes weekly salaries.'

  static options: CommandOptions = {}

  async run() {
    this.logger.info('Starting referral level calculation and salary distribution...')

    // 1. Fetch all necessary data in a few queries
    const users = await User.query().preload('wallet')
    const referralLevels = await ReferralLevel.query().orderBy('minReferrals', 'desc')

    // 2. Build in-memory data structures for efficient processing
    const userMap = new Map<number, User>()
    const referralGraph = new Map<number, number[]>() // Maps referrerId to array of their referral Ids
    const activeUserIds = new Set<number>()

    for (const user of users) {
      userMap.set(user.id, user)
      if (user.referrerId) {
        if (!referralGraph.has(user.referrerId)) {
          referralGraph.set(user.referrerId, [])
        }
        referralGraph.get(user.referrerId)!.push(user.id)
      }
      // An active member is defined as a user with investmentBalance > 0.
      if (user.wallet && Number(user.wallet.investmentBalance) > 0) {
        activeUserIds.add(user.id)
      }
    }

    // Helper function to count active team members using the in-memory graph
    const countActiveTeamMembers = (userId: number, processedUsers: Set<number>): number => {
      let count = 0
      const referrals = referralGraph.get(userId) || []

      for (const referralId of referrals) {
        if (processedUsers.has(referralId)) {
          continue
        }
        processedUsers.add(referralId)

        if (activeUserIds.has(referralId)) {
          count++
        }
        count += countActiveTeamMembers(referralId, processedUsers)
      }
      return count
    }

    // 3. Process each user
    for (const user of users) {
      // Calculate direct active referrals
      const directReferrals = referralGraph.get(user.id) || []
      const directActiveReferrals = directReferrals.filter((id) => activeUserIds.has(id)).length

      // Calculate total active team members
      const totalActiveTeamMembers = countActiveTeamMembers(user.id, new Set<number>())

      // Determine eligible level
      let eligibleLevel: ReferralLevel | null = null
      for (const level of referralLevels) {
        // Assuming LV1 is based on direct referrals, LV2+ on total team members
        if (level.level === 1 && directActiveReferrals >= level.minReferrals) {
          eligibleLevel = level
          break
        } else if (level.level > 1 && totalActiveTeamMembers >= level.minReferrals) {
          eligibleLevel = level
          break
        }
      }

      // Update user's referral level if changed
      if (eligibleLevel && user.referralLevelId !== eligibleLevel.id) {
        user.referralLevelId = eligibleLevel.id
        await user.save()
        this.logger.info(
          `User ${user.id} (${user.fullName}) reached level ${eligibleLevel.level}: ${eligibleLevel.name}`
        )
      }

      // 4. Distribute weekly salary
      if (eligibleLevel && eligibleLevel.weeklySalary > 0) {
        const lastWeek = DateTime.now().minus({ weeks: 1 })
        const hasReceivedSalaryThisWeek = await Transaction.query()
          .where('walletId', user.wallet!.id)
          .where('type', 'referral_salary')
          .where('createdAt', '>', lastWeek.toSQL())
          .first()

        if (!hasReceivedSalaryThisWeek) {
          const wallet = user.wallet!
          // Ensure we perform numeric addition
          wallet.balance = Number(wallet.balance) + eligibleLevel.weeklySalary
          await wallet.save()

          await Transaction.create({
            walletId: wallet.id,
            amount: eligibleLevel.weeklySalary,
            type: 'referral_salary',
            description: `Weekly salary for ${eligibleLevel.name} (Level ${eligibleLevel.level})`,
            status: 'completed',
          })
          this.logger.info(
            `Distributed ${eligibleLevel.weeklySalary} USDT weekly salary to user ${user.id} (${user.fullName}) for level ${eligibleLevel.level}`
          )
        }
      }
    }

    this.logger.info('Referral level calculation and salary distribution completed.')
  }
}
