import type { HttpContext } from '@adonisjs/core/http'
import User from '#models/user'

export default class TeamController {
  /**
   * Returns the full referral tree of a user (by email or id)
   */
  async show({ request, response }: HttpContext) {
    const identifier = request.input('identifier', '')

    if (!identifier) {
      return response.badRequest({ error: 'identifier (email or id) is required.' })
    }

    const rootUser = await User.query()
      .where('email', identifier)
      .orWhere('id', identifier)
      .first()

    if (!rootUser) {
      return response.notFound({ error: 'User not found.' })
    }

    const tree = await this.buildTree(rootUser.id)

    return response.ok({
      root: {
        id: rootUser.id,
        fullName: rootUser.fullName,
        email: rootUser.email,
        referralCode: rootUser.referralCode,
        kycStatus: rootUser.kycStatus,
      },
      team: tree,
      total: this.countNodes(tree),
    })
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
