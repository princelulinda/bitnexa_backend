import { BaseCommand, args } from '@adonisjs/core/ace'
import User from '#models/user'

export default class InspectTeam extends BaseCommand {
  static commandName = 'inspect:team'
  static description = 'Display the full referral team tree of a user.'
  static options = { startApp: true }

  @args.string({ description: 'User email or ID' })
  declare identifier: string

  async run() {
    // Find root user by email or ID
    const rootUser = await User.query()
      .where('email', this.identifier)
      .orWhere('id', this.identifier)
      .first()

    if (!rootUser) {
      this.logger.error(`User not found: ${this.identifier}`)
      return
    }

    this.logger.info(`Team of: ${rootUser.fullName ?? rootUser.email} (${rootUser.id})`)
    this.logger.info(`Referral code: ${rootUser.referralCode}`)
    this.logger.info('─'.repeat(60))

    const totalCount = await this.printTree(rootUser.id, 0)

    this.logger.info('─'.repeat(60))
    this.logger.info(`Total team members: ${totalCount}`)
  }

  private async printTree(userId: string, depth: number): Promise<number> {
    const referrals = await User.query()
      .where('referrerId', userId)
      .preload('wallet')
      .preload('subscriptions', (q) => q.where('status', 'active').preload('plan'))
      .orderBy('createdAt', 'asc')

    let count = 0

    for (const member of referrals) {
      count++
      const indent = '  '.repeat(depth) + (depth > 0 ? '└─ ' : '├─ ')
      const plan = member.subscriptions[0]?.plan?.name ?? 'No plan'
      const balance = member.wallet ? Number(member.wallet.balance).toFixed(2) : '0.00'
      const invested = member.wallet ? Number(member.wallet.investmentBalance).toFixed(2) : '0.00'

      this.logger.info(
        `${indent}${member.fullName ?? 'N/A'} | ${member.email} | Plan: ${plan} | Balance: $${balance} | Invested: $${invested} | KYC: ${member.kycStatus}`
      )

      // Recurse into sub-referrals
      const subCount = await this.printTree(member.id, depth + 1)
      count += subCount
    }

    return count
  }
}
