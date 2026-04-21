import type { HttpContext } from '@adonisjs/core/http'
import User from '#models/user'
import Wallet from '#models/wallet'

export default class AdminLockedCapitalController {
  /**
   * Returns all users with a lockedCapital > 0, along with their full referral team.
   */
  async index({ response }: HttpContext) {
    const wallets = await Wallet.query()
      .where('locked_capital', '>', 0)
      .preload('user', (q) => q.preload('referralLevel'))

    const result = []

    for (const wallet of wallets) {
      const user = wallet.user
      if (!user) continue

      const team = await this.buildTree(user.id)

      result.push({
        user: {
          id: user.id,
          fullName: user.fullName,
          email: user.email,
          referralCode: user.referralCode,
          kycStatus: user.kycStatus,
          currentLevel: user.referralLevel?.level ?? 0,
        },
        wallet: {
          balance: Number(wallet.balance).toFixed(2),
          investmentBalance: Number(wallet.investmentBalance).toFixed(2),
          lockedCapital: Number(wallet.lockedCapital).toFixed(2),
          withdrawalUnlockLevel: wallet.withdrawalUnlockLevel,
        },
        team: team,
        teamSize: this.countNodes(team),
      })
    }

    return response.ok(result)
  }

  private async buildTree(userId: string): Promise<any[]> {
    const referrals = await User.query()
      .where('referrerId', userId)
      .preload('wallet')
      .preload('subscriptions', (q) => q.where('status', 'active').preload('plan'))
      .orderBy('createdAt', 'asc')

    const nodes = []
    for (const member of referrals) {
      nodes.push({
        id: member.id,
        fullName: member.fullName,
        email: member.email,
        referralCode: member.referralCode,
        kycStatus: member.kycStatus,
        plan: member.subscriptions[0]?.plan?.name ?? null,
        balance: member.wallet ? Number(member.wallet.balance).toFixed(2) : '0.00',
        investmentBalance: member.wallet ? Number(member.wallet.investmentBalance).toFixed(2) : '0.00',
        joinedAt: member.createdAt,
        children: await this.buildTree(member.id),
      })
    }
    return nodes
  }

  private countNodes(tree: any[]): number {
    return tree.reduce((acc, node) => acc + 1 + this.countNodes(node.children), 0)
  }
}
